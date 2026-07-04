/* eslint-disable @typescript-eslint/no-explicit-any */
// ↑ noInlineConfig: true により無効化コメントは処理されず(下の any は検出され続ける)、
//   さらに eslint-comments/no-use がコメント自体を検出することをテストする。

// 通常領域の型迂回記述(ルール 6.1)のフィクスチャ。
// 期待値は eslint-config.test.ts が定義する。

export const asserted = { length: 1 } as { length: number };

export const angle = <string>"text";

export const allowedConst = { mode: "fast" } as const;

export function isText(value: unknown): value is string {
  return typeof value === "string";
}

export function firstChar(value?: string): string {
  return value!.charAt(0);
}

let definite!: number;
export function readDefinite(): number {
  return definite;
}

export class DeclaredField {
  declare token: string;
}

// オーバーロード宣言: 宣言シグネチャが実装(unknown を返す)より強い型を主張できる
export function definitely<T>(value: T | undefined): T;
export function definitely(value: unknown): unknown {
  return value;
}

export class OverloadedMethod {
  narrow(value: string | undefined): string;
  narrow(value: unknown): unknown {
    return value;
  }
}

// abstract メソッドはオーバーロード宣言の禁止には巻き込まれない(検出件数の固定)が、
// メソッド構文の双変検査の穴として banAbstractMethodSyntax が検出する(ルール 6.8.4)。
// プロパティ構文の abstract メンバーと abstract アクセサは検出されない側の固定。
export abstract class AbstractBase {
  abstract describe(): string;
  abstract describeProp: () => string;
  abstract get label(): string;
}

declare const ambient: number;
export const ambientUse = ambient;

declare module "fs" {}

export namespace Legacy {}

export const anyValue: any = JSON.parse("{}");

// @ts-expect-error 説明付きでも TS エラー抑制コメントは禁止
export const suppressed: number = "text";
