import { RuleTester } from "@typescript-eslint/rule-tester";
import { fileURLToPath } from "node:url";
import * as vitest from "vitest";

import rule from "./no-readonly-to-mutable.ts";

RuleTester.afterAll = vitest.afterAll;
RuleTester.describe = vitest.describe;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*"],
      },
      tsconfigRootDir: fileURLToPath(new URL("./fixtures", import.meta.url)),
    },
  },
});

ruleTester.run("no-readonly-to-mutable", rule, {
  valid: [
    // readonly を保存する代入は許可
    `
      const frozen: { readonly count: number } = { count: 0 };
      const kept: { readonly count: number } = frozen;
    `,
    // スプレッドによる明示的なコピーは新しい可変な値なので許可
    `
      const frozen: { readonly count: number } = { count: 0 };
      const copy: { count: number } = { ...frozen };
    `,
    // 可変 -> readonly の向き(型が強くなる向き)は許可
    `
      const mutable: { count: number } = { count: 0 };
      const frozen: { readonly count: number } = mutable;
    `,
    // Union の構成要素に「違反なく代入できる型」があれば許可
    `
      const frozen: { readonly count: number } = { count: 0 };
      const widened: { readonly count: number } | { count: number } = frozen;
    `,
    // readonly を保存したパラメータへ渡すのは許可
    `
      const frozen: { readonly count: number } = { count: 0 };
      function consume(value: { readonly count: number }): number {
        return value.count;
      }
      consume(frozen);
    `,
    // ジェネリックの恒等関数は型がそのまま通るため許可
    `
      const frozen: { readonly count: number } = { count: 0 };
      function identity<T>(value: T): T {
        return value;
      }
      const same: { readonly count: number } = identity(frozen);
    `,
    // プリミティブは対象外
    `
      const label: string = "abc";
      const copy: string = label;
    `,
    // 型注釈のない宣言は推論が readonly を保存するため対象外
    `
      const frozen: { readonly count: number } = { count: 0 };
      const inferred = frozen;
    `,
    // ジェネリックのインスタンス化シンボル(Map の readonly size など)は
    // 両辺で readonly 性が一致するため許可(transient 判定の回帰テスト)
    `
      const store: Map<string, { count: number }> = new Map();
      function consume(entries: Map<string, { count: number }>): number {
        return entries.size;
      }
      consume(store);
    `,
    // Union の構成要素が readonly を保持していれば、再帰型のソースでも許可
    // (seen 複製の導入で過検出・無限再帰が生じないことの確認)
    `
      type Box = { readonly value: number };
      type Sink = Box | { nested: Box };
      type Frozen = { readonly value: number; nested: Frozen };
      function keep(frozen: Frozen): Sink {
        return frozen;
      }
    `,
    // 型注釈のないクラスフィールドは推論が readonly を保存するため対象外
    `
      const frozen: { readonly count: number } = { count: 0 };
      class Holder {
        field = frozen;
      }
    `,
    // readonly を保存するクラスフィールド初期化子は許可
    `
      const frozen: { readonly count: number } = { count: 0 };
      class Holder {
        field: { readonly count: number } = frozen;
      }
    `,
    // readonly を保存するデフォルト引数は許可
    `
      const frozen: { readonly count: number } = { count: 0 };
      function consume(value: { readonly count: number } = frozen): number {
        return value.count;
      }
    `,
  ],
  invalid: [
    // 変数宣言: readonly が外れる代入
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        const leaked: { count: number } = frozen;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // ネストしたプロパティで readonly が外れる代入
    {
      code: `
        const frozen: { box: { readonly value: number } } = { box: { value: 0 } };
        const leaked: { box: { value: number } } = frozen;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "box.value" } }],
    },
    // 代入式
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        let sink: { count: number } = { count: 1 };
        sink = frozen;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // 関数呼び出しの引数
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        function mutate(value: { count: number }): void {
          value.count = 1;
        }
        mutate(frozen);
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // コンストラクタ呼び出しの引数
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        class Holder {
          constructor(public value: { count: number }) {}
        }
        new Holder(frozen);
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // return 文(宣言された戻り値型で readonly が外れる)
    {
      code: `
        function leak(value: { readonly count: number }): { count: number } {
          return value;
        }
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // アロー関数の式本体
    {
      code: `
        const leak = (value: { readonly count: number }): { count: number } => value;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // mapped type (Readonly<T>) 由来の readonly も検出する
    {
      code: `
        type Counter = { count: number };
        const frozen: Readonly<Counter> = { count: 0 };
        const leaked: Counter = frozen;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // readonly インデックスシグネチャが可変なものへ落ちる代入
    {
      code: `
        const frozen: { readonly [key: string]: number } = { a: 0 };
        const leaked: { [key: string]: number } = frozen;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "[index]" } }],
    },
    // Union のどの構成要素へ代入しても readonly が外れる場合は検出する
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        const leaked: { count: number } | { count: number; extra?: string } = frozen;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // Union ターゲット: 先行する構成要素の違反探索が seen に記録した型ペアを、
    // 後続の構成要素の探索が「違反なし」と誤読して検出漏れしないこと
    // (seen 汚染の回帰テスト)。Box が両構成要素で同一の型として共有され、
    // どちらへ代入しても readonly が外れるため、報告されなければならない。
    {
      code: `
        type Box = { value: number };
        type Sink = Box | { nested: Box };
        type Frozen = { readonly value: number; nested: Frozen };
        function leak(frozen: Frozen): Sink {
          return frozen;
        }
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "value" } }],
    },
    // 交差型のプロパティも検査する
    {
      code: `
        type WithId = { readonly id: string };
        type WithName = { name: string };
        const frozen: WithId & WithName = { id: "x", name: "y" };
        const leaked: { id: string } = frozen;
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "id" } }],
    },
    // クラスフィールドの初期化子で readonly が外れる代入
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        class Holder {
          field: { count: number } = frozen;
        }
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // accessor フィールドの初期化子も同様に検査する
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        class Holder {
          accessor field: { count: number } = frozen;
        }
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
    // デフォルト引数で readonly が外れる受け渡し
    {
      code: `
        const frozen: { readonly count: number } = { count: 0 };
        function consume(value: { count: number } = frozen): number {
          return value.count;
        }
      `,
      errors: [{ messageId: "readonlyToMutable", data: { path: "count" } }],
    },
  ],
});
