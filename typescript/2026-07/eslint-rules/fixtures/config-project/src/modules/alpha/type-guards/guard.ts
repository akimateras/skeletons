// 例外領域 1: type-guards/(ルール 3.6・6.1)のフィクスチャ。
// 明示的な型述語のみ緩和され、アサーション関数とその他の型迂回は禁止のまま。

export function isLabel(value: unknown): value is string {
  return typeof value === "string";
}

export function assertLabel(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error("not a string");
  }
}

export const stillBanned = { length: 1 } as { length: number };

// type-guards/ は純粋領域でもあるため、時刻の直接取得(ルール 3.2・7.1)は禁止のまま
export const evaluatedAt = new Date();
