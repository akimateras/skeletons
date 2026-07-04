import type { CustomerId } from "../../../shared/model/customerId.ts";
import type { Money } from "../../../shared/model/money.ts";
import type { ProductId } from "../../../shared/model/productId.ts";
import type { OrderId } from "./orderId.ts";
import type { Quantity } from "./quantity.ts";

// 内部限定でランタイム値が不要な列挙は、単純な文字列リテラル Union で表す(ルール 6.9)
export type OrderStatus = "placed" | "shipped" | "canceled";

export type OrderLine = {
  readonly productId: ProductId;
  readonly quantity: Quantity;
  // 注文時点の単価を明細に固定する(後から商品価格が変わっても注文は変わらない)
  readonly unitPrice: Money;
};

export type Order = {
  readonly id: OrderId;
  readonly customerId: CustomerId;
  readonly lines: readonly OrderLine[];
  readonly status: OrderStatus;
  readonly placedAt: Date;
  readonly totalAmount: Money;
};
