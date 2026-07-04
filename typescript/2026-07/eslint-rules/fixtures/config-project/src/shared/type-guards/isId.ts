// 例外領域 1: shared/type-guards/(ルール 3.6)のフィクスチャ。
// modules 内の type-guards/ と同じ扱いで型述語が緩和される。

export function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// shared/ も純粋領域であり、時刻の直接取得(ルール 3.2・7.1)は禁止される
export const sharedNow = Date.now();
