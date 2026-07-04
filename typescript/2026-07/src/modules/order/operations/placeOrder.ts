import { z } from "zod";
// 他モジュールへの依存は operations のみ・公開入口経由で行う(ルール 4.1・5.2)
import type { ProductRepository } from "../../catalog/index.ts";
import type { CustomerId } from "../../../shared/model/customerId.ts";
import { ProductIdSchema, type ProductId } from "../../../shared/model/productId.ts";
import { calculateOrderTotal } from "../model/calculateOrderTotal.ts";
import type { Order, OrderLine } from "../model/order.ts";
import { QuantitySchema } from "../model/quantity.ts";
import type { Clock } from "../ports/clock.ts";
import type { OrderIdGenerator } from "../ports/orderIdGenerator.ts";
import type { OrderRepository } from "../ports/orderRepository.ts";

// リクエスト本文のスキーマは消費する operations 側が所有する(ルール 6.7.1)。
// 実行主体(customerId)は本文ではなく認証情報から来るため、スキーマには含めない。
export const PlaceOrderRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: ProductIdSchema,
        quantity: QuantitySchema,
      }),
    )
    .min(1)
    .readonly(),
});

export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;

export type PlaceOrderInput = PlaceOrderRequest & {
  readonly customerId: CustomerId;
};

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "PRODUCT_NOT_FOUND"; productId: ProductId };

export async function placeOrder(
  input: PlaceOrderInput,
  deps: {
    orderRepository: OrderRepository;
    orderIdGenerator: OrderIdGenerator;
    clock: Clock;
    productRepository: ProductRepository;
  },
): Promise<PlaceOrderResult> {
  const lines: OrderLine[] = [];
  for (const requested of input.lines) {
    const product = await deps.productRepository.findById(requested.productId);
    if (product === undefined) {
      return { ok: false, reason: "PRODUCT_NOT_FOUND", productId: requested.productId };
    }
    // 注文時点の単価を明細に固定する
    lines.push({
      productId: product.id,
      quantity: requested.quantity,
      unitPrice: product.price,
    });
  }

  const order: Order = {
    id: deps.orderIdGenerator.generate(),
    customerId: input.customerId,
    lines,
    status: "placed",
    placedAt: deps.clock.now(),
    totalAmount: calculateOrderTotal(lines),
  };
  await deps.orderRepository.save(order);
  return { ok: true, order };
}
