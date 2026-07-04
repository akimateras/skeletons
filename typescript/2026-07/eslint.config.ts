import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// アーキテクチャルール 10.2: 標準の ESLint / typescript-eslint に存在しない検査を
// 補う自作ルール(eslint-rules/)。`local/` プレフィックスで登録する。
import { localPlugins } from "./eslint-rules/plugin.ts";

// アーキテクチャルール 6.1「型迂回記述」(および 15.4 の process 経路封鎖)に対応する
// no-restricted-syntax セレクタ。
// 例外領域（ルール 6.1 の3領域）は、この一覧から必要最小限のセレクタを除いて再構成する。
const banNonNullAssertion = {
  selector: "TSNonNullExpression",
  message: "Non-null assertion is not allowed. Narrow the type explicitly instead.",
};

const banAngleBracketAssertion = {
  selector: "TSTypeAssertion",
  message:
    "Angle-bracket type assertion is banned. Validate external data with zod (api request/response, database, cli json output, etc.).",
};

const banAsAssertion = {
  selector:
    "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const'])",
  message:
    "`as` type assertion is banned (except `as const`). Use `satisfies`, or validate external data with zod.",
};

const banTypePredicate = {
  selector: "TSTypePredicate",
  message:
    "Explicit type predicates are not allowed. Use inferred type predicates, or validate external data with zod.",
};

// type-guards/ では `value is T` のみ許可し、アサーション関数は禁止のまま残す（ルール 3.6）
const banAssertsPredicate = {
  selector: "TSTypePredicate[asserts=true]",
  message:
    "Assertion functions (`asserts value is T`) are not allowed, even in type-guards/. Return a result type instead (rule 8.1).",
};

// 宣言側の `!` は式の `!`(TSNonNullExpression)とは別ノードのため、個別に禁止する
const banDefiniteAssignment = {
  selector: ":matches(VariableDeclarator, PropertyDefinition, AccessorProperty)[definite=true]",
  message:
    "Definite assignment assertion (`x!: T`) is not allowed. Initialize the value explicitly instead.",
};

// クラスフィールドの `declare` 修飾子(`declare x: T`)は初期化検査を無効化し、
// definite assignment assertion と同等の「実行時の裏付けなしの型宣言」になるため禁止する。
// ambient クラス(`declare class`)内のフィールドは banAmbientValueDeclaration が担う。
const banDeclareClassField = {
  selector: ":matches(PropertyDefinition, AccessorProperty)[declare=true]",
  message:
    "`declare` class fields fabricate a type without runtime backing (equivalent to `x!: T`). Initialize the field explicitly instead.",
};

// 関数・メソッドのオーバーロード宣言(実装を持たないシグネチャの並記)。
// TypeScript のオーバーロード整合性検査は緩く、宣言シグネチャが実装より強い型を
// 主張できる(例: `(v: T | undefined): T` の宣言 + `unknown` を返す実装で非null
// アサーションを再発明できる)ため、型迂回の抜け道として禁止する。
// TSDeclareFunction[declare=true](ambient 宣言)は banAmbientValueDeclaration が担い、
// TSAbstractMethodDefinition には一致しないため abstract メソッドは対象外
// (abstract メソッド自体は banAbstractMethodSyntax が別途禁止する)。
const banOverloadSignatures = {
  selector:
    ":matches(TSDeclareFunction[declare=false], MethodDefinition > TSEmptyBodyFunctionExpression)",
  message:
    "Function/method overload signatures are not allowed: TypeScript's loose overload check lets the declared signature claim more than the implementation guarantees. Use union parameters or generics instead.",
};

// クラスの abstract メソッド(実装を持たない宣言)。メソッド構文のシグネチャは
// strictFunctionTypes の対象外でパラメータが双変検査されるため、契約より狭い入力型の
// サブクラス実装が override 検査を素通りする(interface のメソッド構文と同じ穴。
// interface・型リテラル側は method-signature-style が塞ぐが、同ルールはクラスの
// abstract メソッドには適用されない: ルール 6.8.4)。プロパティ構文
// (`abstract save: (x: T) => void`)は反変検査を受けるため、そちらで宣言する。
// 実装を持つメソッドは契約のプロパティ構文の型に対して検査されるため対象外。
// アクセサ(kind='get'/'set')もプロパティとして型検査されるため対象外。
const banAbstractMethodSyntax = {
  selector: "TSAbstractMethodDefinition[kind='method']",
  message:
    "Abstract method declarations are not allowed: method syntax is checked bivariantly, so a subclass implementation narrower than the contract passes the override check. Declare the member as a property-style function type (`abstract save: (x: T) => void`) instead (rule 6.8.4).",
};

// 宣言マージ(ルール 6.8.3)の侵入口となる宣言(declare module / declare global / namespace)。
// 外部パッケージの型やグローバル型をファイル横断で書き換えられ、unsafe/ はどの領域からも
// 依存されうるため影響が全域に及ぶ。unsafe/ を含む全域で禁止する。
// TSModuleDeclaration は declare の有無を問わず namespace 宣言にも一致する。
const banModuleAndGlobalDeclaration = {
  selector: "TSModuleDeclaration",
  message:
    "`declare module` / `declare global` / `namespace` are not allowed anywhere, including src/unsafe. They enable declaration merging across files (rules 6.1 / 6.8.3).",
};

// 値の ambient 宣言は実行時の裏付けなしに型を捏造できるため、unsafe/ 以外で禁止する
// (unsafe/ では `declare const` によるユニークシンボルの宣言などに限り緩和する: ルール 6.1)。
// TSDeclareFunction は declare なしの関数オーバーロード宣言にも一致するため [declare=true] で
// 限定する(オーバーロード宣言は banOverloadSignatures が別途禁止する)。
const banAmbientValueDeclaration = {
  selector:
    ":matches(TSDeclareFunction[declare=true], VariableDeclaration[declare=true], ClassDeclaration[declare=true])",
  message:
    "Ambient value declarations (`declare const` / `declare function` / `declare class`) are not allowed outside src/unsafe. They fabricate types without runtime backing (rule 6.1).",
};

const banNullLiteral = {
  selector: "Literal[raw='null']",
  message:
    "`null` value is not allowed. Use `undefined`, and convert external `null` at boundaries (adapters/).",
};

const banEnum = {
  selector: "TSEnumDeclaration",
  message:
    "`enum` is not allowed. Use a string literal union (optionally via `z.enum(...)` + `z.infer`, or an `as const` array).",
};

// ルール 6.1: .d.ts 宣言ファイルはファイルごと禁止する。宣言ファイル内の宣言は
// すべて暗黙に ambient となり、`declare` キーワードなしで banAmbientValueDeclaration
// ([declare=true]) をすり抜けて型を捏造できるため、個別の宣言ではなくファイル自体を
// 禁止する。import されない宣言ファイルと、実装 .js の宣言として解決される import 経路は
// dependency-cruiser でも検出する。
const banDeclarationFile = {
  selector: "Program",
  message:
    "Declaration files (.d.ts) are not allowed: every declaration in them is implicitly ambient and fabricates types without runtime backing (rule 6.1).",
};

// ルール 10: プロジェクト標準のソース拡張子は .ts(.mts/.cts)のみ。ESLint の検査対象は
// files glob(拡張子)で選別されるため、標準外の拡張子のファイルは何も検査されずに
// 素通りする(プローブで実証済み: 純粋領域に置いた .tsx は、JSX 構文を含まなければ
// tsc を通過し、outgoing 依存が1つあれば no-orphans にもならず、as / any / Date.now()
// を含んだまま check 全体を通過する)。.ts からの import は現状 TS6142(--jsx 未設定)が
// 偶然塞ぐが、tsconfig の jsx オプション一発で開くため、型定義に依存せずファイルごと
// 禁止する(.d.ts の禁止と同じ方式)。.js/.mjs/.cjs は tsconfig(allowJs なし)の管轄外で
// 型検査もされないため、src/ 配下で同様にファイルごと禁止する。
const banNonStandardSourceFile = {
  selector: "Program",
  message:
    "Source files must use the .ts (.mts/.cts) extension. Other extensions (.tsx/.jsx/.js) are not matched by the lint globs and would evade every guardrail (rule 10).",
};

// ルール 15.4 の補完: no-restricted-imports は静的 import / export-from のみが対象のため、
// dynamic import 経由の process 取得(`await import("node:process")`)を検出できない。
// この経路も全域(config/ を含む)で塞ぐ。process が必要な場合はグローバルの `process` を使う。
const banDynamicProcessImport = {
  selector: "ImportExpression[source.value=/^(node:)?process$/]",
  message:
    "Do not dynamically import `process`. Use the global `process` instead (env vars only via config/, rule 15.4).",
};

// ルール 4.2 / 5.2 の補完: dependency-cruiser は import 指定子を静的に解決して
// 依存方向・公開入口・外部パッケージ制限(ルール 4）を強制するが、実行時に組み立てた
// 指定子の動的 import(`import(node + "fs")`、`import(`node:${x}`)` など)は解決できず、
// 依存検査を素通りする。これにより純粋領域が `import(computed)` で node:fs 等の I/O へ
// 到達したり、モジュール内部へ公開入口を迂回して到達できてしまう(banDynamicProcessImport
// は指定子が `process` リテラルの場合しか塞がない)。動的 import の指定子は文字列
// リテラルに限定し、dependency-cruiser が必ず解決・検査できる形に強制する。
// リテラルの動的 import(`import("node:fs")` など)は許可され、その可否は
// dependency-cruiser が領域ごとに判定する。
const banNonLiteralDynamicImport = {
  selector: "ImportExpression:not([source.type='Literal'])",
  message:
    "Dynamic import specifiers must be string literals so dependency-cruiser can resolve and enforce them (rules 4.2 / 5.2). A computed specifier bypasses the dependency checks.",
};

// ルール 3.2 / 7.1: 純粋領域(modules/*/model・operations・ports・type-guards、
// および shared/)では、現在時刻・乱数・I/O をグローバルから直接取得しない。
// import 経路(node:crypto など)は dependency-cruiser(ルール 4.2)が塞ぐため、
// ここでは import を伴わないグローバル直接参照を塞ぐ。副作用は ports / deps で
// 注入する。検出されない残余経路(シャドーイング・別名付け `const D = Date` のほか、
// Date を第一級の値として渡す `Reflect.construct(Date, [])` や `[Date].map(...)`、
// 変数キーの computed アクセス `Date[key]` など、データフロー解析なしには追えない
// 経路)はレビューで担保する。
// 引数付きの new Date(value) は入力からの決定的な構築なので許可する
// (現在時刻を読むのは引数なしの new Date() と関数呼び出しの Date() のみ。
// スプレッド第1引数は banSpreadDateConstruction が、Function.prototype 経由の
// 呼び出しは pureAreaPropertyBans の Date.call / apply / bind が別途禁止する)。
const banAmbientDateConstruction = {
  selector:
    ":matches(NewExpression[callee.name='Date'][arguments.length=0], CallExpression[callee.name='Date'])",
  message:
    "Do not read the current time in pure areas. Inject a clock via ports/deps (rules 3.2 / 7.1). `new Date(value)` with an explicit argument is allowed.",
};
// スプレッドが第1引数の Date 構築は、AST 上は引数ありでも空タプル・空配列の展開で
// 実行時に引数なしの new Date()(現在時刻の読み取り)になりうるため、
// banAmbientDateConstruction(arguments.length=0)では検出できない。第1引数が
// 通常の式なら構築は入力から決定的なので、第2引数以降のスプレッドは対象外。
const banSpreadDateConstruction = {
  selector: "NewExpression[callee.name='Date'][arguments.0.type='SpreadElement']",
  message:
    "Do not construct Date with a leading spread argument in pure areas: an empty spread reads the clock (`new Date()`) at runtime. Spell the arguments explicitly (rules 3.2 / 7.1).",
};
// import.meta はホスト環境情報(モジュールのファイルパス・URL、vite 系ランタイムでは
// import.meta.env が環境変数)の読み取りで、navigator・process と同類の環境情報の
// 入口になる。識別子ではなく構文(MetaProperty)のため no-restricted-globals の
// 識別子禁止では塞げず、セレクタで禁止する。import.meta.env は現状 types: ["node"]
// の型定義に存在せず tsc も塞ぐが、vite/client の types 追加一発で開くため、
// 型定義に依存せずここで封じる。
const banImportMeta = {
  selector: "MetaProperty[meta.name='import'][property.name='meta']",
  message:
    "Do not read `import.meta` (module path/URL, host environment) in pure areas. Inject environment info via ports/deps (rules 3.2 / 7.1).",
};
const pureAreaSyntaxBans = [
  banAmbientDateConstruction,
  banSpreadDateConstruction,
  banImportMeta,
];

const pureAreaPropertyBans = [
  {
    object: "Date",
    property: "now",
    message:
      "Do not read the current time in pure areas. Inject a clock via ports/deps (rules 3.2 / 7.1).",
  },
  // Function.prototype 経由の Date 呼び出し。Date.call(undefined) / Date.apply(...)
  // は Date() と同じく現在時刻の文字列を返し、Date.bind() は引数なし構築子・呼び出しの
  // 別名を作る。識別子 Date へのプロパティアクセスなので Date.now と同じ形で検出できる
  // (Date を第一級の値として渡す経路はコメント上部の残余経路と同様レビュー担保)。
  ...["call", "apply", "bind"].map((property) => ({
    object: "Date",
    property,
    message:
      "Do not invoke `Date` via call/apply/bind in pure areas (it reads the current time like `Date()`). Inject a clock via ports/deps (rules 3.2 / 7.1).",
  })),
  {
    object: "Math",
    property: "random",
    message:
      "Do not use ambient randomness in pure areas. Inject a generator via ports/deps (rules 3.2 / 7.1).",
  },
  // AbortSignal.timeout(ms) は "abort" イベント経由で setTimeout 相当のタイマーになる
  // (setTimeout の識別子禁止だけでは残る経路)。
  {
    object: "AbortSignal",
    property: "timeout",
    message:
      "Do not create timers via `AbortSignal.timeout` in pure areas. Inject a clock/timer via ports/deps (rules 3.2 / 7.1).",
  },
  // 純粋なコードは globalThis に触れる理由がない。個別に塞いだグローバルへの
  // 迂回路(globalThis.Math.random() など)をまとめて閉じるため、プロパティを
  // 限定せず globalThis 経由のアクセス全体を禁止する。別名付け
  // (`const g = globalThis`)による迂回は、pureAreaGlobalBans の識別子禁止が塞ぐ。
  {
    object: "globalThis",
    message:
      "Do not access globals via `globalThis` in pure areas. Pure code receives all effects via inputs/deps (rules 3.2 / 7.1).",
  },
];

const pureAreaGlobalBans = [
  "fetch",
  // Node 22 以降が import なしで提供するネットワーク・メッセージングのグローバル。
  // fetch と同クラスの I/O・通信経路として禁止する。
  "WebSocket",
  "BroadcastChannel",
  "MessageChannel",
  "console",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "crypto",
  "performance",
  // process は import を伴わないグローバルで、I/O(process.stdout)・時刻
  // (process.hrtime)・プロセス制御(process.exit)・環境変数の入口になる。
  // process.env の禁止(no-restricted-properties)だけでは残りが素通りするため、
  // 純粋領域では識別子ごと禁止する。
  "process",
  // navigator はホスト環境の読み取り(language・hardwareConcurrency・platform など)。
  // process と同じ環境情報の入口として禁止する。
  "navigator",
  // Intl はホストのロケール・タイムゾーンの読み取り(navigator と同類の環境情報)に
  // 加え、引数なしの Intl.DateTimeFormat#format() が現在時刻の読み取りになる。
  // ロケール整形はプレゼンテーション関心で境界に属するため、識別子ごと禁止する。
  // グローバル識別子を経由しない同類のロケール依存メソッド(Date#toLocaleString /
  // Number#toLocaleString / String#localeCompare など。現在時刻は読めない)は
  // 識別子禁止では検出できない残余経路であり、レビューで担保する。
  "Intl",
  // no-restricted-properties(object: "globalThis")は識別子名の一致しか見ないため、
  // `const g = globalThis` と別名を付けると迂回できる。純粋なコードは globalThis に
  // 触れる理由がないため、識別子そのものを禁止して別名付けを封じる。
  "globalThis",
].map((name) => ({
  name,
  message:
    "Pure areas must not touch I/O, timers, randomness, the clock, or host environment info via globals. Inject effects via ports/deps (rules 3.2 / 7.1).",
}));

// 通常領域(ルール 6.1)の no-restricted-syntax 一覧。
// 6.1 の型迂回記述に加えて、process のすり抜け経路の封鎖(15.4)を含む。
// 例外領域はこの一覧から緩和対象を除いて再構成し、禁止項目の追加漏れを防ぐ。
const baseSyntaxBans = [
  banNonNullAssertion,
  banDefiniteAssignment,
  banDeclareClassField,
  banAngleBracketAssertion,
  banAsAssertion,
  banTypePredicate,
  banOverloadSignatures,
  banAbstractMethodSyntax,
  banModuleAndGlobalDeclaration,
  banAmbientValueDeclaration,
  banNullLiteral,
  banEnum,
  banDynamicProcessImport,
  banNonLiteralDynamicImport,
];

const syntaxBansExcept = (...relaxed: readonly { selector: string }[]) =>
  baseSyntaxBans.filter((ban) => !relaxed.includes(ban));

// ルール 6.5: null 型の禁止一覧。adapters/（ルール 6.1・6.5）では null のみ緩和するため、
// 将来ここに型を追加しても adapters/ で null 以外の禁止が維持されるよう分離して定義する。
const restrictedTypes = {
  null: {
    message: "Use `undefined` instead.",
  },
};
const { null: _null, ...restrictedTypesInAdapters } = restrictedTypes;

// ルール 3.10 / 15.4: process.env は config/ のみが参照する。
// restrictedTypes と同様に一覧を分離定義し、将来ここにエントリを追加しても
// config/ では process.env の緩和だけが維持されるようにする。
const restrictedProperties = [
  {
    object: "process",
    property: "env",
    message: "Do not read process.env directly. Load configuration via config/ (rule 15.4).",
  },
];
const restrictedPropertiesInConfig = restrictedProperties.filter(
  (entry) => !(entry.object === "process" && entry.property === "env"),
);

// ルール 3.10 / 15.4 の補完: no-restricted-properties(object: "process")は
// 識別子 `process` へのメンバーアクセスしか検出できないため、それをすり抜ける
// 経路(`import { env } from "node:process"`、`globalThis.process.env`、
// レガシーエイリアス `global` 経由)も塞ぐ。
// process が必要な場合はグローバルの `process` を使う(上記の制限が適用される)。
const restrictedImports = [
  {
    name: "process",
    message:
      "Do not import `process`. Use the global `process` instead (env vars only via config/, rule 15.4).",
  },
  {
    name: "node:process",
    message:
      "Do not import `node:process`. Use the global `process` instead (env vars only via config/, rule 15.4).",
  },
];
const banGlobalThisProcess = {
  object: "globalThis",
  property: "process",
  message:
    "Do not access `process` via `globalThis`. Use the global `process` directly (rule 15.4).",
};
// globalThis.global.process のような多段エイリアスを塞ぐ
// (識別子 `global` 自体は no-restricted-globals で禁止する)。
const banGlobalThisGlobal = {
  object: "globalThis",
  property: "global",
  message:
    "Do not access the legacy `global` alias via `globalThis` (escape route to `process.env`, rule 15.4).",
};
const globalProcessAliasBans = [banGlobalThisProcess, banGlobalThisGlobal];

// レガシーエイリアス `global` は全域で禁止する。`global.process.env` が
// no-restricted-properties(object: "process")をすり抜けるため、エイリアス自体を塞ぐ。
const restrictedGlobals = [
  {
    name: "global",
    message:
      "Use `globalThis` instead of the legacy `global` alias (blocks the `global.process.env` escape route, rule 15.4).",
  },
];

export default defineConfig(
  // eslint-rules/ は Lint 基盤であり、ESLint の検査対象から除外する(ルール 10.2)。
  // TypeScript コンパイラの内部 API や eslint 本体との型相互運用は型迂回記述なしでは
  // 扱えないため(ルール 6.1 末尾)。
  // 型検査(tsc)とルール自体のテスト(rule-tester)は通常どおり適用される。
  globalIgnores(["node_modules", "coverage", "eslint-rules"]),

  // ---- 通常領域（ルール 6.1）----
  // テストファイル（*.test.ts）にも同一の設定を適用し、緩和しない（ルール 9.7）。
  // プロジェクト標準の拡張子は .ts のみだが、.mts / .cts が lint を素通りしないよう
  // glob には含めておく（各 override も同様）。
  {
    files: ["**/*.{ts,mts,cts}"],
    extends: [tseslint.configs.strictTypeChecked, comments.recommended],
    plugins: localPlugins,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // 6.1: 無効化コメントを報告するだけでなく（eslint-comments/no-use）、
    // インライン設定の処理自体を止めて無効化する
    linterOptions: {
      noInlineConfig: true,
    },
    rules: {
      // 6.1: any と unsafe 系
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // 6.1: 型アサーション・型述語・ambient 宣言・null・enum
      "no-restricted-syntax": ["error", ...baseSyntaxBans],

      // 6.1: TS エラー抑制コメント（description 付きも含め全面禁止）
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
        },
      ],

      // 6.1: ESLint 無効化コメント
      "@eslint-community/eslint-comments/no-use": "error",

      // eval は任意コード実行であり、本設定のあらゆる禁止（process.env の
      // 封鎖など）の迂回路になるため全域で禁止する。暗黙の eval（文字列引数の
      // タイマー・new Function）は strictTypeChecked の no-implied-eval が禁止する。
      "no-eval": "error",

      // 6.10: readonly なオブジェクトを可変な型で受けない。TypeScript の代入可能性は
      // プロパティの readonly 修飾子を無視するため、コンパイラ・標準ルールでは
      // 検出できず、自作ルール(eslint-rules/、ルール 10.2)で強制する。
      "local/no-readonly-to-mutable": "error",

      // 6.5: null 型の禁止（値は no-restricted-syntax で禁止）
      "@typescript-eslint/no-restricted-types": ["error", { types: restrictedTypes }],

      // 3.10 / 15.4: process.env は config/ のみが参照する（config/ の override で緩和）。
      // globalThis 経由のアクセスは config/ を含む全域で禁止する。
      "no-restricted-properties": ["error", ...restrictedProperties, ...globalProcessAliasBans],

      // 3.10 / 15.4: レガシーエイリアス `global` は config/ を含む全域で禁止する
      "no-restricted-globals": ["error", ...restrictedGlobals],

      // 3.10 / 15.4: process モジュールの import 自体を全域で禁止する
      // （named import で no-restricted-properties をすり抜けられるため）
      "no-restricted-imports": ["error", { paths: restrictedImports }],

      // 6.9 / 8.1: Union の網羅性を switch で機械的に担保する。
      // default 節による網羅の偽装を許さず、Union に値が増えたら必ず lint が落ちるようにする。
      // 網羅できない対象（string / number など）への switch には default 節を要求する。
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
      ],

      // 6.8: interface は ports/ の能力契約に限る（ports/ の override で緩和）
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],

      // 6.8.4: interface・型リテラルの関数メンバーはプロパティ構文で書く。
      // メソッド構文のシグネチャは strictFunctionTypes の対象外でパラメータが
      // 双変(bivariant)に検査されるため、port 契約より狭い入力型の adapter 実装が
      // エラーにならない。ports/ を含む全域で緩和しない。
      "@typescript-eslint/method-signature-style": ["error", "property"],

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  // ---- 純粋領域（ルール 3.2・7.1・4.2）----
  // 時刻・乱数・I/O のグローバル直接参照を禁止する。境界領域（app/・config/・
  // adapters/・main.ts）は対象外。モジュールの公開入口（index.ts）と unsafe/ は
  // 純粋領域から合法に依存でき、グローバル参照は import を伴わず依存検査でも
  // 検出できないため、迂回路にならないよう対象に含める（ルール 3.7）。
  // type-guards/ と unsafe/ の no-restricted-syntax は後続の例外領域 override が
  // 再構成するため、そちらにも pureAreaSyntaxBans を含める。
  {
    files: [
      "src/modules/**/model/**/*.{ts,mts,cts}",
      "src/modules/**/operations/**/*.{ts,mts,cts}",
      "src/modules/**/ports/**/*.{ts,mts,cts}",
      "src/modules/**/type-guards/**/*.{ts,mts,cts}",
      "src/modules/*/index.{ts,mts,cts}",
      // 公開入口と同居するテストにも同一の設定を適用する(ルール 9.7。
      // model/ 等の内部のテストはディレクトリの glob が既に含んでいる)
      "src/modules/*/index.test.{ts,mts,cts}",
      "src/modules/*/index.test-d.{ts,mts,cts}",
      "src/shared/**/*.{ts,mts,cts}",
      "src/unsafe/**/*.{ts,mts,cts}",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...baseSyntaxBans, ...pureAreaSyntaxBans],
      "no-restricted-properties": [
        "error",
        ...restrictedProperties,
        ...globalProcessAliasBans,
        ...pureAreaPropertyBans,
      ],
      "no-restricted-globals": ["error", ...restrictedGlobals, ...pureAreaGlobalBans],
    },
  },

  // ---- 例外領域 1: type-guards/（ルール 3.6・6.1）----
  // 明示的な型述語 `value is T` のみ緩和する。アサーション関数（asserts）は禁止のまま。
  // この例外は、Type Guard 関数を隔離領域に集めて探しやすくし、レビュー漏れを
  // 減らすためのもの（ルール 3.6）。
  // shared/type-guards/ は共有カーネル（shared/model）の型に対する同位置付けの領域（ルール 3.6）。
  // type-guards/ は純粋領域でもあるため、pureAreaSyntaxBans を維持する。
  {
    files: [
      "src/modules/**/type-guards/**/*.{ts,mts,cts}",
      "src/shared/type-guards/**/*.{ts,mts,cts}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...syntaxBansExcept(banTypePredicate),
        banAssertsPredicate,
        ...pureAreaSyntaxBans,
      ],
    },
  },

  // ---- 例外領域 2: unsafe/（ルール 3.7・6.1）----
  // 型ユーティリティを定義する目的に限り、型アサーション（as / <T>value）・
  // 値の ambient 宣言（declare const など）・型レベルの any・オーバーロード宣言を緩和する。
  // any の緩和は no-explicit-any のみで、any 型の「値」の使用を検出する unsafe 系
  // ルール（no-unsafe-assignment など）は維持する。
  // null・enum・型述語・非nullアサーション系・declare クラスフィールドは禁止のまま。
  // 宣言マージの侵入口（declare module / declare global / namespace）も
  // unsafe/ では緩和しない（ルール 6.8.3）。
  // unsafe/ は純粋領域でもある（どの領域からも依存されうるため、副作用を置くと
  // 純粋領域の迂回路になる）ので、pureAreaSyntaxBans を維持する（ルール 3.7）。
  // この緩和は通常の実装コードで型アサーションを使うための抜け道ではない（ルール 3.7.1）。
  {
    files: ["src/unsafe/**/*.{ts,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-restricted-syntax": [
        "error",
        ...syntaxBansExcept(
          banAngleBracketAssertion,
          banAsAssertion,
          banAmbientValueDeclaration,
          banOverloadSignatures,
        ),
        ...pureAreaSyntaxBans,
      ],
    },
  },

  // ---- 例外領域 3: adapters/（ルール 6.1・6.5）----
  // 外部システムとの境界表現に限り、null の型・値のみ緩和する。
  {
    files: ["src/modules/**/adapters/**/*.{ts,mts,cts}"],
    rules: {
      "no-restricted-syntax": ["error", ...syntaxBansExcept(banNullLiteral)],
      "@typescript-eslint/no-restricted-types": [
        "error",
        { types: restrictedTypesInAdapters },
      ],
    },
  },


  // ---- config/（ルール 3.10・15.4）----
  // 環境変数の読み込み・検証は config/ のみが担うため、process.env の参照を許可する。
  // rule ごとオフにはせず、process.env 以外の制限は維持する。
  // globalThis.process と process モジュールの import は config/ でも禁止のまま
  // （グローバルの `process` で足りるため）。
  {
    files: ["src/config/**/*.{ts,mts,cts}"],
    rules: {
      "no-restricted-properties": [
        "error",
        ...restrictedPropertiesInConfig,
        ...globalProcessAliasBans,
      ],
    },
  },

  // ---- ports/（ルール 6.8.1）----
  // adapters/ が実装する能力契約に限り interface を許可する。
  {
    files: ["src/modules/**/ports/**/*.{ts,mts,cts}"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off",
    },
  },

  // ---- 宣言ファイル .d.ts の禁止（ルール 6.1）----
  // 例外領域(type-guards/・unsafe/・adapters/)の緩和 override より後に置き、
  // どの領域でも宣言ファイルがファイルごと禁止されるようにする。
  {
    files: ["**/*.d.{ts,mts,cts}"],
    rules: {
      "no-restricted-syntax": ["error", ...baseSyntaxBans, banDeclarationFile],
    },
  },

  // ---- 標準外拡張子のファイル禁止（ルール 10）----
  // この override が files に含めることで、eslint . がこれらのファイルを検査対象として
  // 列挙するようになる(含めなければ「どの設定にも一致しない」として無検査で素通りする)。
  // .tsx/.jsx は全域で禁止する。.js 系は src/ 配下のみ禁止する(リポジトリ直下の
  // .dependency-cruiser.cjs やビルド成果物 dist/ は対象外)。
  // 型情報は不要(Program セレクタのみ)だが、.tsx の TypeScript 構文を espree は
  // パースできないため、パーサだけ typescript-eslint を指定する。
  {
    files: ["**/*.{tsx,jsx}", "src/**/*.{js,mjs,cjs}"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-restricted-syntax": ["error", banNonStandardSourceFile],
    },
  },
);
