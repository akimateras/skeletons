// 純粋領域(ルール 3.2・7.1)のフィクスチャ。
// 時刻・乱数・I/O のグローバル直接参照が禁止されることの検証用。
// 期待値は eslint-config.test.ts が定義する。

export const now = Date.now();

export const timestamp = new Date();

export const legacyTimestamp = Date();

// 引数付きの new Date(value) は決定的な構築なので許可される
export const fromValue = new Date(0);

// スプレッド第1引数の構築は、空タプルの展開で実行時に引数なしの new Date()
// (現在時刻の読み取り)になりうるため禁止される
const emptyDateArgs: [] = [];
export const spreadTimestamp = new Date(...emptyDateArgs);

// Function.prototype 経由の Date 呼び出しも Date() と同じく現在時刻を読む
export const calledTime = Date.call(undefined);

export const roll = Math.random();

export const viaGlobalThis = globalThis.Math;

export const response = fetch("https://example.com");

export const socket = new WebSocket("wss://example.invalid");

export const channel = new BroadcastChannel("side-channel");

export const ports = new MessageChannel();

// 別名付けによる globalThis の迂回は、識別子自体の禁止で検出される
const aliasedGlobalThis = globalThis;
export const aliasedRoll = aliasedGlobalThis.Math.random();

console.log("side effect");

export const timer = setTimeout(() => undefined, 0);

// AbortSignal.timeout は "abort" イベント経由の setTimeout 相当
export const abortTimer = AbortSignal.timeout(100);

export const id = crypto.randomUUID();

export const elapsed = performance.now();

export const out = process.stdout;

// navigator はホスト環境の読み取り(process と同じ環境情報の入口)
export const cores = navigator.hardwareConcurrency;

// Intl はロケール・タイムゾーンの環境情報に加え、引数なしの format() が現在時刻を読む
export const localizedNow = new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format();

// import.meta はホスト環境情報(モジュールのパス・URL、vite 系では env)の入口。
// 識別子ではなく構文のため no-restricted-globals では塞げず、セレクタで禁止される
export const moduleUrl = import.meta.url;

// 計算済み指定子の動的 import は dependency-cruiser が解決できず、純粋領域から
// node:fs 等の I/O へ到達する迂回路になる(ルール 4.2 / 5.2)。指定子を
// 文字列リテラルに限定する ban で塞ぐ。
const fsModule = ["node:", "fs/promises"].join("");
export const escapedIo = import(fsModule);
