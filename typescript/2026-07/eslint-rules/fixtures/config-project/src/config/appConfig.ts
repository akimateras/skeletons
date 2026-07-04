// config/(ルール 3.10・15.4)のフィクスチャ。
// process.env の参照のみ緩和され、globalThis 経由や import 経由は禁止のまま。

export const rawPort = process.env["PORT"];

export const stillBanned = globalThis.process;
