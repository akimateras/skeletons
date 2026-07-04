import { expect, test } from "vitest";
import { CustomerIdSchema } from "../../../shared/model/customerId.ts";
import { MoneySchema } from "../../../shared/model/money.ts";
import { ProductIdSchema } from "../../../shared/model/productId.ts";
import type { Order, OrderStatus } from "../model/order.ts";
import { OrderIdSchema } from "../model/orderId.ts";
import { QuantitySchema } from "../model/quantity.ts";
import { createInMemoryOrderRepository } from "./inMemoryOrderRepository.ts";

// adapter が port の契約を満たすことを検証する(ルール 9.3)

const orderId = OrderIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

function orderFixture(status: OrderStatus): Order {
  return {
    id: orderId,
    customerId: CustomerIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    lines: [
      {
        productId: ProductIdSchema.parse("11111111-1111-4111-8111-111111111111"),
        quantity: QuantitySchema.parse(1),
        unitPrice: MoneySchema.parse(500),
      },
    ],
    status,
    placedAt: new Date("2026-07-01T09:00:00.000Z"),
    totalAmount: MoneySchema.parse(500),
  };
}

test("保存していない ID の findById は undefined を返す", async () => {
  const repository = createInMemoryOrderRepository();
  expect(await repository.findById(orderId)).toBeUndefined();
});

test("save した注文を findById で取得できる", async () => {
  const repository = createInMemoryOrderRepository();
  const order = orderFixture("placed");

  await repository.save(order);

  expect(await repository.findById(orderId)).toStrictEqual(order);
});

test("同じ ID で save すると上書きされる(状態遷移の保存)", async () => {
  const repository = createInMemoryOrderRepository();

  await repository.save(orderFixture("placed"));
  await repository.save(orderFixture("canceled"));

  const found = await repository.findById(orderId);
  if (found === undefined) {
    throw new Error("saved order must be found");
  }
  expect(found.status).toBe("canceled");
});
