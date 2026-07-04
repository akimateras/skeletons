import { expect, test } from "vitest";
import { CustomerIdSchema } from "../../../shared/model/customerId.ts";
import { MoneySchema } from "../../../shared/model/money.ts";
import { ProductIdSchema } from "../../../shared/model/productId.ts";
import { markOrderCanceled } from "./markOrderCanceled.ts";
import type { Order, OrderStatus } from "./order.ts";
import { OrderIdSchema } from "./orderId.ts";
import { QuantitySchema } from "./quantity.ts";

function orderFixture(status: OrderStatus): Order {
  return {
    id: OrderIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    customerId: CustomerIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    lines: [
      {
        productId: ProductIdSchema.parse("11111111-1111-4111-8111-111111111111"),
        quantity: QuantitySchema.parse(2),
        unitPrice: MoneySchema.parse(500),
      },
    ],
    status,
    placedAt: new Date("2026-07-01T09:00:00.000Z"),
    totalAmount: MoneySchema.parse(1000),
  };
}

test("placed の注文はキャンセルでき、他のフィールドは保存される", () => {
  const order = orderFixture("placed");

  const result = markOrderCanceled(order);

  if (!result.ok) {
    throw new Error(`unexpected failure: ${result.reason}`);
  }
  expect(result.order.status).toBe("canceled");
  expect(result.order).toStrictEqual({ ...order, status: "canceled" });
});

test("キャンセル済みの注文は ALREADY_CANCELED になる", () => {
  const result = markOrderCanceled(orderFixture("canceled"));
  expect(result).toStrictEqual({ ok: false, reason: "ALREADY_CANCELED" });
});

test("出荷済みの注文は ALREADY_SHIPPED になる", () => {
  const result = markOrderCanceled(orderFixture("shipped"));
  expect(result).toStrictEqual({ ok: false, reason: "ALREADY_SHIPPED" });
});
