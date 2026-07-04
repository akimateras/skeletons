import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import * as ts from "typescript";

// アーキテクチャルール 6.10 / 10.2: readonly なオブジェクト値が、その readonly が
// 外れた型へ渡る箇所を検出する。TypeScript の構造的部分型ではプロパティの
// readonly 修飾子が代入可能性に影響しない(microsoft/TypeScript#13347)ため、
// コンパイラでは検出できず、このルールで補完する。
//
// 検出対象の構文:
// - 型注釈付きの変数宣言(`const x: T = ...`)
// - `=` による代入式
// - 関数・コンストラクタ呼び出しの引数
// - 型注釈付きのクラスフィールド(`accessor` フィールドを含む)の初期化子
// - 型注釈付きパラメータのデフォルト値
// - `return` 文とアロー関数の式本体(戻り値型が宣言されている場合)
//
// 既知の限界(検出されない経路。該当箇所はレビューで readonly 性の保存を確認する、
// ルール 6.10):
// - スプレッド引数・レストパラメータ経由の受け渡し
// - 関数型の値(コールバック)の代入における、戻り値・引数側の readonly の脱落
// - ジェネリック型引数の推論を経由した readonly の脱落
// - 深さ上限(MAX_DEPTH)を超える深いネスト
// - mutation API 経由の書き換え(`Object.assign(frozen, patch)` など。第1引数の型が
//   readonly のまま推論され、型上の readonly の脱落を伴わないため検出対象にならない)

type MessageIds = "readonlyToMutable";
type Options = [];

// Readonly<T> / Pick<T, K> などの mapped type や `as const` 由来の readonly は、
// 宣言の modifier ではなく transient symbol の CheckFlags にのみ現れる。これを
// 判定できる公開 API は存在せず、内部 API の getCheckFlags / CheckFlags に頼る
// しかない(公開 d.ts に宣言は無いが、実行時には ts 名前空間に存在する)。
// as で型付けし、存在と値はロード時に検証する。TypeScript の更新で内部 API が
// 変わった場合は、誤検出ではなく lint の起動失敗として即座に顕在化する。
// (判定の振る舞い自体は no-readonly-to-mutable.test.ts が固定している。)
type TsInternalApi = {
  getCheckFlags: (symbol: ts.Symbol) => number;
  CheckFlags: {
    Instantiated: number;
    Readonly: number;
  };
};

function loadTsInternalApi(): TsInternalApi {
  const internal = ts as unknown as Partial<TsInternalApi>;

  if (
    typeof internal.getCheckFlags !== "function" ||
    internal.CheckFlags?.Instantiated !== 1 ||
    internal.CheckFlags.Readonly !== 8
  ) {
    throw new Error(
      "TypeScript internal API (ts.getCheckFlags / ts.CheckFlags) has changed. " +
        "Update eslint-rules/no-readonly-to-mutable.ts for this TypeScript version.",
    );
  }

  return {
    getCheckFlags: internal.getCheckFlags,
    CheckFlags: internal.CheckFlags,
  };
}

const tsInternalApi = loadTsInternalApi();

// 再帰のたびに新しい型がインスタンス化される生成的な再帰型は、型ペアの記録
// (seen)ではサイクルとして検出できないため、深さで打ち切る。実用上のネストは
// この深さに収まり、超えた分は検出しない(false negative 側に倒す)。
const MAX_DEPTH = 16;

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/akimateras/ai-native-skeleton/blob/main/eslint-rules/${name}.ts`,
);

function isPrimitiveLike(type: ts.Type): boolean {
  return (
    (type.flags &
      (ts.TypeFlags.StringLike |
        ts.TypeFlags.NumberLike |
        ts.TypeFlags.BigIntLike |
        ts.TypeFlags.BooleanLike |
        ts.TypeFlags.ESSymbolLike |
        ts.TypeFlags.EnumLike)) !==
    0
  );
}

// getPropertiesOfType が交差型のプロパティも列挙するため、Object に加えて
// Intersection も対象にする(A & B の見落とし防止)。
function isObjectLike(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) !== 0;
}

function joinPath(path: string, segment: string): string {
  return path === "" ? segment : `${path}.${segment}`;
}

// プロパティが readonly かどうかをシンボル単位で判定する。
// 1. getter のみのアクセサ(代入すると実行時エラーになるため readonly と同等)
// 2. CheckFlags.Readonly を持つ合成シンボル
//    (mapped type / as const / Union・Intersection の合成要素)
// 3. 上記以外の合成(transient かつ非インスタンス化)シンボル: checker が意図的に
//    readonly を落として作り直したもの(例: spread `{ ...frozen }` の結果)。
//    宣言オブジェクトは元の readonly シンボルから引き継がれるため、宣言修飾子を
//    見てはならない。可変として扱う。
// 4. 宣言由来・ジェネリックのインスタンス化シンボル: 宣言上の readonly 修飾子
//    (interface / type literal / class / パラメータプロパティ)を見る。
function isReadonlyProperty(symbol: ts.Symbol): boolean {
  if (
    (symbol.flags & ts.SymbolFlags.GetAccessor) !== 0 &&
    (symbol.flags & ts.SymbolFlags.SetAccessor) === 0
  ) {
    return true;
  }

  const checkFlags = tsInternalApi.getCheckFlags(symbol);
  if ((checkFlags & tsInternalApi.CheckFlags.Readonly) !== 0) {
    return true;
  }

  if (
    (symbol.flags & ts.SymbolFlags.Transient) !== 0 &&
    (checkFlags & tsInternalApi.CheckFlags.Instantiated) === 0
  ) {
    return false;
  }

  return (symbol.getDeclarations() ?? []).some(
    (declaration) =>
      (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly) !== 0,
  );
}

export default createRule<Options, MessageIds>({
  name: "no-readonly-to-mutable",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow assigning values with readonly properties to types that drop the readonly modifier.",
    },
    schema: [],
    messages: {
      readonlyToMutable:
        "Property '{{path}}' loses `readonly` here, allowing mutation through the new alias. " +
        "Keep the target type readonly, or create a copy instead (DEVELOPMENT.md 6.10).",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    // (source, target) 型ペアの探索記録。探索中に同じペアへ戻ってきた場合
    // (再帰型のサイクル)と、別経路で探索済みのペアの再探索を打ち切る。
    // 違反を見つけた時点で即座に return するため、記録済みペアは
    // 「違反なし」または「探索中(違反なしと仮定してよい)」のいずれかになる。
    // 唯一の例外は Union ターゲットの探索で、違反を見つけても後続の構成要素へ
    // ループを継続する。そこでは seen の複製を使い、違反を含む探索が記録した
    // ペアを後続の探索が「違反なし」と誤読しないように隔離する(下記)。
    function cloneSeen(seen: Map<ts.Type, Set<ts.Type>>): Map<ts.Type, Set<ts.Type>> {
      return new Map([...seen].map(([source, targets]) => [source, new Set(targets)]));
    }

    function findReadonlyToMutable(
      rawSource: ts.Type,
      rawTarget: ts.Type,
      path: string,
      seen: Map<ts.Type, Set<ts.Type>>,
      depth: number,
    ): string | undefined {
      if (rawSource === rawTarget || depth > MAX_DEPTH) {
        return undefined;
      }
      if (isPrimitiveLike(rawSource) || isPrimitiveLike(rawTarget)) {
        return undefined;
      }

      const source = checker.getApparentType(rawSource);
      const target = checker.getApparentType(rawTarget);
      if (source === target) {
        return undefined;
      }

      let seenTargets = seen.get(source);
      if (seenTargets === undefined) {
        seenTargets = new Set();
        seen.set(source, seenTargets);
      } else if (seenTargets.has(target)) {
        return undefined;
      }
      seenTargets.add(target);

      if (source.isUnion()) {
        for (const part of source.types) {
          const found = findReadonlyToMutable(part, target, path, seen, depth + 1);
          if (found !== undefined) {
            return found;
          }
        }
        return undefined;
      }

      if (target.isUnion()) {
        // Union への代入は「いずれかの構成要素へ代入可能」で成立する。違反なく
        // 代入できる構成要素がひとつでもあれば安全とみなし、代入可能な構成要素の
        // すべてが違反する場合に限り報告する(readonly を保持した構成要素を持つ
        // Union に対する過検出の防止)。
        // 違反を見つけても次の構成要素へループを継続するため、ここだけは
        // 「記録済みペア = 違反なし」の前提が崩れる。各構成要素の探索には
        // seen の複製を渡し、違反を含む探索の記録が後続へ漏れないようにする。
        let firstFound: string | undefined;
        for (const part of target.types) {
          if (!checker.isTypeAssignableTo(source, part)) {
            continue;
          }
          const found = findReadonlyToMutable(source, part, path, cloneSeen(seen), depth + 1);
          if (found === undefined) {
            return undefined;
          }
          firstFound ??= found;
        }
        return firstFound;
      }

      if (!isObjectLike(source) || !isObjectLike(target)) {
        return undefined;
      }

      for (const targetProp of checker.getPropertiesOfType(target)) {
        const sourceProp = source.getProperty(targetProp.getName());
        if (sourceProp === undefined) {
          continue;
        }

        const propertyPath = joinPath(path, targetProp.getName());

        if (isReadonlyProperty(sourceProp) && !isReadonlyProperty(targetProp)) {
          return propertyPath;
        }

        const found = findReadonlyToMutable(
          checker.getTypeOfSymbol(sourceProp),
          checker.getTypeOfSymbol(targetProp),
          propertyPath,
          seen,
          depth + 1,
        );
        if (found !== undefined) {
          return found;
        }
      }

      // readonly なインデックスシグネチャが可変なものへ落ちる経路も同じ穴になる。
      const sourceIndexInfos = checker.getIndexInfosOfType(source);
      for (const targetInfo of checker.getIndexInfosOfType(target)) {
        const sourceInfo = sourceIndexInfos.find((info) => info.keyType === targetInfo.keyType);
        if (sourceInfo === undefined) {
          continue;
        }

        const indexPath = joinPath(path, "[index]");
        if (sourceInfo.isReadonly && !targetInfo.isReadonly) {
          return indexPath;
        }

        const found = findReadonlyToMutable(
          sourceInfo.type,
          targetInfo.type,
          indexPath,
          seen,
          depth + 1,
        );
        if (found !== undefined) {
          return found;
        }
      }

      return undefined;
    }

    function compareAndReport(
      sourceType: ts.Type,
      targetType: ts.Type,
      reportNode: TSESTree.Node,
    ): void {
      const found = findReadonlyToMutable(sourceType, targetType, "", new Map(), 0);
      if (found !== undefined) {
        context.report({
          node: reportNode,
          messageId: "readonlyToMutable",
          data: { path: found },
        });
      }
    }

    function checkAssignmentLike(
      sourceNode: TSESTree.Expression,
      targetNode: TSESTree.Node,
    ): void {
      compareAndReport(
        services.getTypeAtLocation(sourceNode),
        services.getTypeAtLocation(targetNode),
        sourceNode,
      );
    }

    // return 文とアロー関数の式本体は、宣言された戻り値型を文脈型として比較する
    // (async の Promise 剥がしも文脈型の解決に含まれる)。戻り値型の注釈がない
    // 場合は文脈型が無く、推論結果は readonly を保存するため検査不要。
    function checkAgainstContextualType(expression: TSESTree.Expression): void {
      const tsExpression = services.esTreeNodeToTSNodeMap.get(expression);
      // マップの戻り値型には import / new キーワードトークンが含まれうるため絞り込む
      if (!ts.isExpression(tsExpression)) {
        return;
      }

      const contextualType = checker.getContextualType(tsExpression);
      if (contextualType === undefined) {
        return;
      }

      compareAndReport(services.getTypeAtLocation(expression), contextualType, expression);
    }

    function checkCallArguments(node: TSESTree.CallExpression | TSESTree.NewExpression): void {
      const tsCallNode = services.esTreeNodeToTSNodeMap.get(node);
      const signature = checker.getResolvedSignature(tsCallNode);
      if (signature === undefined) {
        return;
      }

      const parameters = signature.getParameters();

      for (const [index, argument] of node.arguments.entries()) {
        if (argument.type === AST_NODE_TYPES.SpreadElement) {
          continue;
        }

        const parameter = parameters[index];
        if (parameter === undefined) {
          continue;
        }

        // レストパラメータは配列型で受けるため引数との1対1対応が崩れる。
        // 検査対象外とする(既知の限界、ファイル冒頭の一覧を参照)。
        const declaration = parameter.valueDeclaration;
        if (
          declaration !== undefined &&
          ts.isParameter(declaration) &&
          declaration.dotDotDotToken !== undefined
        ) {
          continue;
        }

        compareAndReport(
          services.getTypeAtLocation(argument),
          checker.getTypeOfSymbolAtLocation(parameter, tsCallNode),
          argument,
        );
      }
    }

    // クラスフィールド(accessor フィールドを含む)の初期化子。型注釈がある場合のみ、
    // 宣言型と初期化子の型を比較する(注釈が無ければ推論が readonly を保存する)。
    // 対象ノード自体(PropertyDefinition / AccessorProperty)が宣言された
    // プロパティ型を持つため、比較のターゲットにはノードをそのまま渡す。
    function checkClassFieldInitializer(
      node: TSESTree.PropertyDefinition | TSESTree.AccessorProperty,
    ): void {
      if (node.typeAnnotation === undefined || !node.value) {
        return;
      }
      checkAssignmentLike(node.value, node);
    }

    return {
      VariableDeclarator(node): void {
        if (node.id.typeAnnotation === undefined || !node.init) {
          return;
        }
        checkAssignmentLike(node.init, node.id);
      },

      PropertyDefinition: checkClassFieldInitializer,
      AccessorProperty: checkClassFieldInitializer,

      // 型注釈付きパラメータのデフォルト値。分割代入内部のデフォルト値(注釈を
      // 持てない)は推論が readonly を保存するため対象外。
      AssignmentPattern(node): void {
        const { left } = node;
        if (
          left.type !== AST_NODE_TYPES.Identifier &&
          left.type !== AST_NODE_TYPES.ObjectPattern &&
          left.type !== AST_NODE_TYPES.ArrayPattern
        ) {
          return;
        }
        if (left.typeAnnotation === undefined) {
          return;
        }
        checkAssignmentLike(node.right, left);
      },

      AssignmentExpression(node): void {
        if (node.operator !== "=") {
          return;
        }
        checkAssignmentLike(node.right, node.left);
      },

      CallExpression: checkCallArguments,
      NewExpression: checkCallArguments,

      ReturnStatement(node): void {
        if (!node.argument) {
          return;
        }
        checkAgainstContextualType(node.argument);
      },

      ArrowFunctionExpression(node): void {
        if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
          checkAgainstContextualType(node.body);
        }
      },
    };
  },
});
