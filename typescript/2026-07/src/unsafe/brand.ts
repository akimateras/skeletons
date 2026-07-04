// ブランド型（名目的型付け）の補助（アーキテクチャルール 6.6）。

// 生値をブランド型へ載せる `as` は、このヘルパにのみ閉じ込める。
// brand() 自体は検証を伴わない。

declare const brandSymbol: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

export function brand<T, B extends string>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}
