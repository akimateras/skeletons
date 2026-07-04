// 通常領域の process.env すり抜け経路(ルール 15.4)のフィクスチャ。
// 期待値は eslint-config.test.ts が定義する。

import { env as importedEnv } from "node:process";

export const reexportedEnv = importedEnv;

export const env = process.env;

export const viaGlobalThis = globalThis.process;

export const viaGlobal = global.process;

export const dynamicProcess = import("node:process");

// eval は process.env の封鎖を含むあらゆる禁止の迂回路になるため全域で禁止(no-eval)
export const evadedEnv: unknown = eval("process.env");
