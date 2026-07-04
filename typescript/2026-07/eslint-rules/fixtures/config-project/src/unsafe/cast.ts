// 例外領域 2: unsafe/(ルール 3.7・6.1)のフィクスチャ。
// 型アサーション・型レベル any・値の ambient 宣言・オーバーロード宣言は緩和され、
// null・declare クラスフィールド・宣言マージの侵入口(declare module 等)は禁止のまま。

declare const brandTag: unique symbol;

export type Branded<T> = T & { readonly [brandTag]: true };

export function brand<T>(value: T): Branded<T> {
  return value as Branded<T>;
}

export type AnyFunction = (...args: any[]) => unknown;

// オーバーロード宣言は unsafe/ では緩和される
export function widen(value: string): unknown;
export function widen(value: unknown): unknown {
  return value;
}

// any「値」の使用を検出する unsafe 系ルール(no-unsafe-assignment など)は
// unsafe/ でも維持される(緩和は型レベルの any = no-explicit-any のみ)
const looseValue: any = 1;
export const bannedUnsafeAssignment = looseValue;

export const bannedNull = null;

export class BannedDeclaredField {
  declare token: string;
}

declare module "fs" {}
