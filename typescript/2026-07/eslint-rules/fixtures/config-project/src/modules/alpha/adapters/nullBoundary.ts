// 例外領域 3: adapters/(ルール 6.1・6.5)のフィクスチャ。
// null の型・値のみ緩和され、その他の型迂回(as など)は禁止のまま。

export type ExternalRow = { name: string | null };

export function toNullable(value?: string): string | null {
  return value ?? null;
}

export const stillBanned = { length: 1 } as { length: number };
