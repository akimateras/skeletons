import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // アーキテクチャルール 9.5: unsafe/ の型テスト（*.test-d.ts）を
    // 通常の npm run test で実行する。
    typecheck: {
      enabled: true,
    },
    // eslint-rules/fixtures は Lint 基盤のテスト用フィクスチャであり、
    // *.test.ts の形をしたファイルもテストではなく lint 対象のサンプル
    // (ルール 9.7 の検証用)のため、テスト収集から除外する。
    exclude: [...configDefaults.exclude, "eslint-rules/fixtures/**"],
  },
});
