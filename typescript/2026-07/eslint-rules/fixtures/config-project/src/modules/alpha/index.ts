// モジュール公開入口(index.ts)への純粋領域ルール適用(迂回路の防止、ルール 3.2・7.1)のフィクスチャ。
// 公開入口は純粋領域(他モジュールの operations/ など)から合法に依存できるため、
// 副作用を直書きすると純粋領域の迂回路になる。同じ禁止が適用されることの検証用。
// 期待値は eslint-config.test.ts が定義する。

export const now = Date.now();

export const timestamp = new Date();

export const roll = Math.random();

export const out = process.stdout;
