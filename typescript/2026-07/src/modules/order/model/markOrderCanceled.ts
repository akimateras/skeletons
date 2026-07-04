import type { Order } from "./order.ts";

export type MarkOrderCanceledResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "ALREADY_CANCELED" | "ALREADY_SHIPPED" };

// 状態遷移は専用の関数で明示する(ルール 14.1)。
// 予期される失敗はタグ付き Union の結果型で返す(ルール 8.1)。
export function markOrderCanceled(order: Order): MarkOrderCanceledResult {
  // Union の網羅性は exhaustive switch で担保する(ルール 6.9)
  switch (order.status) {
    case "placed":
      return { ok: true, order: { ...order, status: "canceled" } };
    case "shipped":
      return { ok: false, reason: "ALREADY_SHIPPED" };
    case "canceled":
      return { ok: false, reason: "ALREADY_CANCELED" };
  }
}
