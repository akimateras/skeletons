// 通常領域の null / enum / interface / 網羅性 / readonly 代入のフィクスチャ。
// 期待値は eslint-config.test.ts が定義する。

export type WithNull = { value: string | null };

export const nullValue = null;

export enum Color {
  Red,
}

export interface Contract {
  run(): void;
}

type Direction = "up" | "down";
export function flip(direction: Direction): string {
  switch (direction) {
    case "up":
      return "down";
  }
  return "up";
}

const frozen: { readonly count: number } = { count: 0 };
export const leaked: { count: number } = frozen;
