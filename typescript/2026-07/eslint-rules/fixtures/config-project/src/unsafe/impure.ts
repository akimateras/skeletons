// unsafe/ への純粋領域ルール適用(ルール 3.7)のフィクスチャ。
// unsafe/ はどの領域からも依存されうるため、時刻・乱数・I/O を置くと
// 純粋領域の迂回路になる。同じ禁止が適用されることの検証用。
// 期待値は eslint-config.test.ts が定義する。

export const now = Date.now();

export const timestamp = new Date();

// 引数付きの new Date(value) は決定的な構築なので許可される
export const fromValue = new Date(0);

export const roll = Math.random();

export const viaGlobalThis = globalThis.Math;

export const out = process.stdout;
