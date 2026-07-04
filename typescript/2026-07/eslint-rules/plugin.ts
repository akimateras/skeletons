import type { Linter } from "eslint";

import noReadonlyToMutable from "./no-readonly-to-mutable.ts";

// アーキテクチャルール 10.2: 自作ルールを `local/` プレフィックスのプラグインとして
// まとめ、eslint.config.ts へ提供する。
//
// 自作ルールがコンパイラの非公開 API に依存する場合は、その存在と値をロード時に
// 検証してから使う(no-readonly-to-mutable の loadTsInternalApi が実例)。TypeScript の
// 更新で内部 API が変わったとき、誤検出ではなく lint の起動失敗として顕在化させる。
//
// typescript-eslint のルール型(create の context が具体型)と eslint 本体の
// RuleDefinition 型は静的には相互変換できないため、ここでキャストして吸収する。
// 実行時の互換性は typescript-eslint 側の設計で保証されている(すべての
// typescript-eslint ルールは eslint 本体の上で動作する)。eslint-rules/ は
// ESLint の検査対象外のため、この `as` はルール 6.1 に抵触しない。
export const localPlugins = {
  local: {
    meta: { name: "local" },
    rules: {
      "no-readonly-to-mutable": noReadonlyToMutable,
    },
  },
} as unknown as NonNullable<Linter.Config["plugins"]>;
