import type { Order } from "../model/order.ts";
import type { OrderId } from "../model/orderId.ts";
import type { OrderRepository } from "../ports/orderRepository.ts";

// インメモリ永続化。プロセスが生きている間だけ保持するサンプル実装であり、
// 実運用では postgresOrderRepository などに置き換える(ルール 3.5)。
export function createInMemoryOrderRepository(): OrderRepository {
  const orders = new Map<OrderId, Order>();
  return {
    findById: (id) => Promise.resolve(orders.get(id)),
    save: (order) => {
      orders.set(order.id, order);
      return Promise.resolve();
    },
  };
}
