import type { Order } from "../model/order.ts";
import type { OrderId } from "../model/orderId.ts";

export interface OrderRepository {
  // 存在しないことは undefined で表す(ルール 3.4・6.5)
  findById: (id: OrderId) => Promise<Order | undefined>;
  save: (order: Order) => Promise<void>;
}
