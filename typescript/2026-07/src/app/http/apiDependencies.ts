import type { ProductIdGenerator, ProductRepository } from "../../modules/catalog/index.ts";
import type { Clock, OrderIdGenerator, OrderRepository } from "../../modules/order/index.ts";

// HTTP handler が必要とする ports の束。具象は main.ts が注入する(ルール 3.11)
export type ApiDependencies = {
  readonly productRepository: ProductRepository;
  readonly productIdGenerator: ProductIdGenerator;
  readonly orderRepository: OrderRepository;
  readonly orderIdGenerator: OrderIdGenerator;
  readonly clock: Clock;
};
