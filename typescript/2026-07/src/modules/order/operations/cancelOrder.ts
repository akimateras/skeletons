import type { CustomerId } from "../../../shared/model/customerId.ts";
import { markOrderCanceled } from "../model/markOrderCanceled.ts";
import type { Order } from "../model/order.ts";
import type { OrderId } from "../model/orderId.ts";
import type { OrderRepository } from "../ports/orderRepository.ts";

export type CancelOrderInput = {
  readonly orderId: OrderId;
  // 認可の判定に必要な実行主体は app/ で暗黙に済ませず入力として渡す(ルール 15.5)
  readonly requestedBy: CustomerId;
};

export type CancelOrderResult =
  | { ok: true; order: Order }
  | {
      ok: false;
      reason: "ORDER_NOT_FOUND" | "FORBIDDEN" | "ALREADY_CANCELED" | "ALREADY_SHIPPED";
    };

export async function cancelOrder(
  input: CancelOrderInput,
  deps: { orderRepository: OrderRepository },
): Promise<CancelOrderResult> {
  const order = await deps.orderRepository.findById(input.orderId);
  if (order === undefined) {
    return { ok: false, reason: "ORDER_NOT_FOUND" };
  }

  // 認可: 自分の注文のみキャンセルできる。失敗は結果型で返す(ルール 15.5)
  if (order.customerId !== input.requestedBy) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  const transition = markOrderCanceled(order);
  if (!transition.ok) {
    return transition;
  }

  await deps.orderRepository.save(transition.order);
  return { ok: true, order: transition.order };
}
