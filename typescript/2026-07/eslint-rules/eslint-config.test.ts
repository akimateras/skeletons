import { ESLint, type Linter } from "eslint";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import eslintConfig from "../eslint.config.ts";

// eslint.config.ts が定める禁止事項と例外領域(DEVELOPMENT.md 10節)が実際に
// 機能していることを、実物の設定 + 型情報付き lint で検証する。
// fixtures/config-project/ 下の実ファイルを ESLint API で lint し、
// ファイルごとに「検出されるべき違反」と「緩和されるべき記述」を固定する。

const projectDir = fileURLToPath(new URL("./fixtures/config-project", import.meta.url));

// フィクスチャプロジェクトを型情報の起点にする(本体の tsconfig ではなく
// fixtures/config-project/tsconfig.json を projectService に解決させる)。
const fixtureParserOverride = {
  files: ["**/*.{ts,mts,cts}"],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: projectDir,
    },
  },
};

const eslint = new ESLint({
  cwd: projectDir,
  overrideConfigFile: true,
  overrideConfig: [...eslintConfig, fixtureParserOverride],
});

const results = await eslint.lintFiles(["src"]);

const resultsByFile = new Map(
  results.map((result) => [
    path.relative(projectDir, result.filePath).split(path.sep).join("/"),
    result,
  ]),
);

function messagesOf(relativePath: string): Linter.LintMessage[] {
  const result = resultsByFile.get(relativePath);
  if (result === undefined) {
    throw new Error(
      `fixture not linted: ${relativePath} (linted: ${[...resultsByFile.keys()].join(", ")})`,
    );
  }
  return result.messages;
}

// ruleId と、必要ならメッセージの部分文字列で違反を特定する。
// no-restricted-syntax のように 1 つの ruleId が複数の禁止を担う場合は
// snippet で区別する。
function violations(
  relativePath: string,
  ruleId: string,
  snippet?: string,
): Linter.LintMessage[] {
  return messagesOf(relativePath).filter(
    (message) =>
      message.ruleId === ruleId &&
      (snippet === undefined || message.message.includes(snippet)),
  );
}

function expectBanned(relativePath: string, ruleId: string, snippet?: string): void {
  expect(
    violations(relativePath, ruleId, snippet),
    `${relativePath} で ${ruleId}${snippet === undefined ? "" : ` (${snippet})`} が検出されるべき`,
  ).not.toHaveLength(0);
}

function expectAllowed(relativePath: string, ruleId: string, snippet?: string): void {
  expect(
    violations(relativePath, ruleId, snippet),
    `${relativePath} で ${ruleId}${snippet === undefined ? "" : ` (${snippet})`} は検出されないべき`,
  ).toHaveLength(0);
}

describe("eslint.config.ts の設定テスト", () => {
  it("すべてのフィクスチャが lint され、致命的エラーがない", () => {
    expect(resultsByFile.size).toBeGreaterThanOrEqual(10);
    for (const [file, result] of resultsByFile) {
      const fatal = result.messages.filter((message) => message.fatal);
      expect(fatal, `${file} で致命的エラー: ${JSON.stringify(fatal)}`).toHaveLength(0);
    }
  });

  describe("通常領域: 型迂回記述の禁止(ルール 6.1)", () => {
    const file = "src/typeBypass.ts";

    it("as 型アサーションを検出する", () => {
      expectBanned(file, "no-restricted-syntax", "`as` type assertion");
    });

    it("as const は許可する", () => {
      // as const の行だけが `as` の例外として通ることを、検出行の突き合わせで確認する
      const asViolations = violations(file, "no-restricted-syntax", "`as` type assertion");
      expect(asViolations).toHaveLength(1);
    });

    it("角括弧型アサーションを検出する", () => {
      expectBanned(file, "no-restricted-syntax", "Angle-bracket");
    });

    it("明示的な型述語を検出する", () => {
      expectBanned(file, "no-restricted-syntax", "Explicit type predicates");
    });

    it("非 null アサーションを検出する", () => {
      expectBanned(file, "no-restricted-syntax", "Non-null assertion");
    });

    it("definite assignment assertion を検出する", () => {
      expectBanned(file, "no-restricted-syntax", "Definite assignment");
    });

    it("declare クラスフィールドを検出する", () => {
      expectBanned(file, "no-restricted-syntax", "`declare` class fields");
    });

    it("関数・メソッドのオーバーロード宣言を検出する(abstract メソッドは除く)", () => {
      // 関数オーバーロード(TSDeclareFunction)とメソッドオーバーロード
      // (TSEmptyBodyFunctionExpression)の両方が検出されることを件数で固定する。
      // abstract メソッドが巻き込まれると 3 件以上になる。
      expect(
        violations(file, "no-restricted-syntax", "overload signatures"),
      ).toHaveLength(2);
    });

    it("abstract メソッドを検出する(プロパティ構文・アクセサの abstract メンバーは許可、ルール 6.8.4)", () => {
      // フィクスチャの AbstractBase はメソッド構文1・プロパティ構文1・getter 1 を含む。
      // プロパティ構文やアクセサが巻き込まれると 2 件以上になる。
      expect(
        violations(file, "no-restricted-syntax", "Abstract method declarations"),
      ).toHaveLength(1);
    });

    it("値の ambient 宣言を検出する", () => {
      expectBanned(file, "no-restricted-syntax", "Ambient value declarations");
    });

    it("declare module / namespace を検出する", () => {
      expect(
        violations(file, "no-restricted-syntax", "declare module").length,
      ).toBeGreaterThanOrEqual(2);
    });

    it("明示的な any を検出する", () => {
      expectBanned(file, "@typescript-eslint/no-explicit-any");
    });

    it("TS エラー抑制コメントを検出する", () => {
      expectBanned(file, "@typescript-eslint/ban-ts-comment");
    });

    it("ESLint 無効化コメントを検出する", () => {
      expectBanned(file, "@eslint-community/eslint-comments/no-use");
    });

    it("noInlineConfig により無効化コメントが機能しない", () => {
      // ファイル先頭に /* eslint-disable no-explicit-any */ があっても
      // any の検出が生きていることを確認する(上の no-explicit-any テストと同義だが、
      // インライン設定の無効化が目的であることを明示するために分ける)
      expectBanned(file, "@typescript-eslint/no-explicit-any");
    });
  });

  describe("通常領域: null / enum / interface / 網羅性 / readonly(ルール 6.5〜6.10)", () => {
    const file = "src/nullEnumInterface.ts";

    it("null 値を検出する", () => {
      expectBanned(file, "no-restricted-syntax", "`null` value");
    });

    it("null 型を検出する", () => {
      expectBanned(file, "@typescript-eslint/no-restricted-types");
    });

    it("enum を検出する", () => {
      expectBanned(file, "no-restricted-syntax", "`enum` is not allowed");
    });

    it("ports/ 以外の interface を検出する", () => {
      expectBanned(file, "@typescript-eslint/consistent-type-definitions");
    });

    it("switch の網羅漏れを検出する", () => {
      expectBanned(file, "@typescript-eslint/switch-exhaustiveness-check");
    });

    it("readonly なオブジェクトの可変型への代入を検出する(自作ルールの配線)", () => {
      expectBanned(file, "local/no-readonly-to-mutable");
    });

    it("メソッド構文の関数メンバーを検出する(ルール 6.8.4)", () => {
      expectBanned(file, "@typescript-eslint/method-signature-style");
    });
  });

  describe("通常領域: 宣言ファイル .d.ts の禁止(ルール 6.1)", () => {
    it(".d.ts をファイルごと検出する(暗黙 ambient 宣言の封鎖)", () => {
      expectBanned("src/fabricated.d.ts", "no-restricted-syntax", "Declaration files");
    });
  });

  describe("標準外拡張子のファイル禁止(ルール 10)", () => {
    it(".tsx をファイルごと検出する(lint glob 不一致による無検査素通りの封鎖)", () => {
      expectBanned("src/bypass.tsx", "no-restricted-syntax", ".ts (.mts/.cts) extension");
    });

    it("src/ 配下の .js をファイルごと検出する", () => {
      expectBanned("src/bypass.js", "no-restricted-syntax", ".ts (.mts/.cts) extension");
    });
  });

  describe("通常領域: process.env のすり抜け経路(ルール 15.4)", () => {
    const file = "src/processAccess.ts";

    it("process.env の直接参照を検出する", () => {
      expectBanned(file, "no-restricted-properties", "process.env directly");
    });

    it("globalThis.process を検出する", () => {
      expectBanned(file, "no-restricted-properties", "via `globalThis`");
    });

    it("レガシーエイリアス global を検出する", () => {
      expectBanned(file, "no-restricted-globals");
    });

    it("process モジュールの静的 import を検出する", () => {
      expectBanned(file, "no-restricted-imports");
    });

    it("process モジュールの動的 import を検出する", () => {
      expectBanned(file, "no-restricted-syntax", "dynamically import");
    });

    it("eval を検出する（あらゆる禁止の迂回路の封鎖）", () => {
      expectBanned(file, "no-eval");
    });
  });

  describe("純粋領域: 時刻・乱数・I/O のグローバル直接参照(ルール 3.2・7.1)", () => {
    const file = "src/modules/alpha/model/impure.ts";

    it("Date.now() を検出する", () => {
      expectBanned(file, "no-restricted-properties", "current time");
    });

    it("引数なしの new Date() と Date() を検出し、引数付きの new Date(value) は許可する", () => {
      // フィクスチャは new Date()・Date()・new Date(0) を1つずつ含む。
      // 引数付きが巻き込まれると 3 件になる。
      expect(violations(file, "no-restricted-syntax", "current time")).toHaveLength(2);
    });

    it("スプレッド第1引数の new Date(...args) を検出する(空タプルの展開が引数なし構築になる経路)", () => {
      expectBanned(file, "no-restricted-syntax", "leading spread");
    });

    it("Date.call / Date.apply / Date.bind を検出する(Function.prototype 経由の現在時刻読み取り)", () => {
      expectBanned(file, "no-restricted-properties", "call/apply/bind");
    });

    it("Math.random() を検出する", () => {
      expectBanned(file, "no-restricted-properties", "randomness");
    });

    it("AbortSignal.timeout() を検出する(setTimeout 相当のタイマー)", () => {
      expectBanned(file, "no-restricted-properties", "AbortSignal.timeout");
    });

    it("globalThis 経由のグローバル参照を検出する", () => {
      expectBanned(file, "no-restricted-properties", "in pure areas");
    });

    it("import.meta を検出する(識別子禁止では塞げないホスト環境情報の入口)", () => {
      expectBanned(file, "no-restricted-syntax", "import.meta");
    });

    it("I/O・タイマー・乱数・時刻のグローバルを検出する", () => {
      for (const name of [
        "fetch",
        "WebSocket",
        "BroadcastChannel",
        "MessageChannel",
        "console",
        "setTimeout",
        "crypto",
        "performance",
        "process",
        "navigator",
        "Intl",
      ]) {
        expectBanned(file, "no-restricted-globals", `'${name}'`);
      }
    });

    it("別名付けした globalThis を検出する(識別子自体の禁止)", () => {
      expectBanned(file, "no-restricted-globals", "'globalThis'");
    });

    it("境界領域(adapters/)では時刻の取得と process・WebSocket・navigator・Intl・AbortSignal.timeout・import.meta を許可する", () => {
      const boundary = "src/modules/alpha/adapters/clockBoundary.ts";
      expectAllowed(boundary, "no-restricted-syntax", "current time");
      expectAllowed(boundary, "no-restricted-syntax", "leading spread");
      expectAllowed(boundary, "no-restricted-properties", "current time");
      expectAllowed(boundary, "no-restricted-properties", "call/apply/bind");
      expectAllowed(boundary, "no-restricted-globals", "'process'");
      expectAllowed(boundary, "no-restricted-globals", "'WebSocket'");
      expectAllowed(boundary, "no-restricted-globals", "'navigator'");
      expectAllowed(boundary, "no-restricted-globals", "'Intl'");
      expectAllowed(boundary, "no-restricted-properties", "AbortSignal.timeout");
      expectAllowed(boundary, "no-restricted-syntax", "import.meta");
    });

    it("shared/ にも適用される", () => {
      expectBanned("src/shared/type-guards/isId.ts", "no-restricted-properties", "current time");
    });

    it("計算済み指定子の動的 import を検出する(dependency-cruiser が解決できない I/O 迂回路、ルール 4.2)", () => {
      expectBanned(file, "no-restricted-syntax", "Dynamic import specifiers must be string literals");
    });
  });

  describe("純粋領域: モジュール公開入口 index.ts への適用（迂回路の防止、ルール 3.2・7.1）", () => {
    const file = "src/modules/alpha/index.ts";

    it("Date.now() を検出する", () => {
      expectBanned(file, "no-restricted-properties", "current time");
    });

    it("引数なしの new Date() を検出する", () => {
      expectBanned(file, "no-restricted-syntax", "current time");
    });

    it("Math.random() を検出する", () => {
      expectBanned(file, "no-restricted-properties", "randomness");
    });

    it("process グローバルを検出する", () => {
      expectBanned(file, "no-restricted-globals", "'process'");
    });
  });

  describe("純粋領域: 公開入口と同居するテストへの適用（ルール 9.7）", () => {
    const file = "src/modules/alpha/index.test.ts";

    it("Date.now() を検出する", () => {
      expectBanned(file, "no-restricted-properties", "current time");
    });

    it("Math.random() を検出する", () => {
      expectBanned(file, "no-restricted-properties", "randomness");
    });
  });

  describe("例外領域 1: type-guards/(ルール 3.6・6.1)", () => {
    const moduleGuard = "src/modules/alpha/type-guards/guard.ts";
    const sharedGuard = "src/shared/type-guards/isId.ts";

    it("明示的な型述語を許可する", () => {
      expectAllowed(moduleGuard, "no-restricted-syntax", "Explicit type predicates");
      expectAllowed(sharedGuard, "no-restricted-syntax", "Explicit type predicates");
    });

    it("アサーション関数は禁止のまま", () => {
      expectBanned(moduleGuard, "no-restricted-syntax", "Assertion functions");
    });

    it("as は禁止のまま", () => {
      expectBanned(moduleGuard, "no-restricted-syntax", "`as` type assertion");
    });

    it("純粋領域の時刻取得の禁止は緩和後も維持される", () => {
      expectBanned(moduleGuard, "no-restricted-syntax", "current time");
    });
  });

  describe("例外領域 2: unsafe/(ルール 3.7・6.1)", () => {
    const file = "src/unsafe/cast.ts";

    it("as 型アサーションを許可する", () => {
      expectAllowed(file, "no-restricted-syntax", "`as` type assertion");
    });

    it("型レベルの any を許可する", () => {
      expectAllowed(file, "@typescript-eslint/no-explicit-any");
    });

    it("any 値の使用を検出する unsafe 系ルールは維持される(緩和は no-explicit-any のみ)", () => {
      expectBanned(file, "@typescript-eslint/no-unsafe-assignment");
    });

    it("値の ambient 宣言(declare const)を許可する", () => {
      expectAllowed(file, "no-restricted-syntax", "Ambient value declarations");
    });

    it("オーバーロード宣言を許可する", () => {
      expectAllowed(file, "no-restricted-syntax", "overload signatures");
    });

    it("null は禁止のまま", () => {
      expectBanned(file, "no-restricted-syntax", "`null` value");
    });

    it("declare クラスフィールドは禁止のまま", () => {
      expectBanned(file, "no-restricted-syntax", "`declare` class fields");
    });

    it("declare module は unsafe/ でも禁止のまま", () => {
      expectBanned(file, "no-restricted-syntax", "declare module");
    });

    describe("純粋領域の副作用禁止は unsafe/ にも適用される（迂回路の防止、ルール 3.7）", () => {
      const impure = "src/unsafe/impure.ts";

      it("Date.now() を検出する", () => {
        expectBanned(impure, "no-restricted-properties", "current time");
      });

      it("引数なしの new Date() を検出し、引数付きの new Date(value) は許可する", () => {
        // フィクスチャは new Date() と new Date(0) を1つずつ含む。
        // 引数付きが巻き込まれると 2 件になる。
        expect(violations(impure, "no-restricted-syntax", "current time")).toHaveLength(1);
      });

      it("Math.random() を検出する", () => {
        expectBanned(impure, "no-restricted-properties", "randomness");
      });

      it("globalThis 経由のグローバル参照を検出する", () => {
        expectBanned(impure, "no-restricted-properties", "in pure areas");
      });

      it("process グローバルを検出する", () => {
        expectBanned(impure, "no-restricted-globals", "'process'");
      });
    });
  });

  describe("例外領域 3: adapters/(ルール 6.1・6.5)", () => {
    const file = "src/modules/alpha/adapters/nullBoundary.ts";

    it("null の値を許可する", () => {
      expectAllowed(file, "no-restricted-syntax", "`null` value");
    });

    it("null の型を許可する", () => {
      expectAllowed(file, "@typescript-eslint/no-restricted-types");
    });

    it("as は禁止のまま", () => {
      expectBanned(file, "no-restricted-syntax", "`as` type assertion");
    });
  });

  describe("config/(ルール 15.4)", () => {
    const file = "src/config/appConfig.ts";

    it("process.env の参照を許可する", () => {
      expectAllowed(file, "no-restricted-properties", "process.env directly");
    });

    it("globalThis.process は禁止のまま", () => {
      expectBanned(file, "no-restricted-properties", "via `globalThis`");
    });
  });

  describe("ports/(ルール 6.8.1・6.8.4)", () => {
    const file = "src/modules/alpha/ports/alphaPort.ts";

    it("interface を許可する", () => {
      expectAllowed(file, "@typescript-eslint/consistent-type-definitions");
    });

    it("メソッド構文は ports/ でも検出し、プロパティ構文は許可する", () => {
      // フィクスチャはプロパティ構文とメソッド構文の関数メンバーを1つずつ含む。
      // プロパティ構文が巻き込まれると 2 件になる。
      expect(violations(file, "@typescript-eslint/method-signature-style")).toHaveLength(1);
    });
  });

  describe("テストファイルへの適用(ルール 9.7)", () => {
    const file = "src/modules/alpha/model/calc.test.ts";

    it("*.test.ts にも as の禁止が適用される", () => {
      expectBanned(file, "no-restricted-syntax", "`as` type assertion");
    });
  });
});
