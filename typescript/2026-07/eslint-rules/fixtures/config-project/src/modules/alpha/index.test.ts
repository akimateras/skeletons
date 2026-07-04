// 公開入口(index.ts)と同居するテストにも純粋領域ルールが適用されること
// (ルール 9.7)のフィクスチャ。期待値は eslint-config.test.ts が定義する。

export const now = Date.now();

export const roll = Math.random();
