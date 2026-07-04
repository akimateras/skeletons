// 境界領域(adapters/)は純粋領域の時刻・乱数・I/O 禁止(ルール 3.2・7.1)の対象外で
// あることのフィクスチャ。ports の Clock 実装などが現在時刻の取得を担う。

export function currentTime(): Date {
  return new Date();
}

export const startedAt = Date.now();

// スプレッド第1引数の Date 構築と Function.prototype 経由の呼び出しも境界領域では許可される
const emptyDateArgs: [] = [];
export const spreadTime = new Date(...emptyDateArgs);
export const calledTime = Date.call(undefined);

// 境界領域では process グローバルの参照も許可される(process.env のみ全域で config/ 経由)
export const out = process.stdout;

// ネットワーク I/O のグローバルも境界領域では許可される
export const socket = new WebSocket("wss://example.invalid");

// ホスト環境の読み取り(navigator)とタイマー(AbortSignal.timeout)も境界領域では許可される
export const cores = navigator.hardwareConcurrency;
export const abortTimer = AbortSignal.timeout(100);

// ロケール整形(Intl)も境界領域では許可される
export const localizedNow = new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format();

// ホスト環境情報の import.meta も境界領域では許可される
export const moduleUrl = import.meta.url;
