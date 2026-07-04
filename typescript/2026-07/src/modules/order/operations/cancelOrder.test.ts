import { expect, test } from "vitest";
import { CustomerIdSchema } from "../../../shared/model/customerId.ts";
import { MoneySchema } from "../../../shared/model/money.ts";
import { ProductIdSchema } from "../../../shared/model/productId.ts";
import type { Order, OrderStatus } from "../model/order.ts";
import { OrderIdSchema } from "../model/orderId.ts";
import { QuantitySchema } from "../model/quantity.ts";
import type { OrderRepository } from "../ports/orderRepository.ts";
import { cancelOrder } from "./cancelOrder.ts";

const orderId = OrderIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const owner = CustomerIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const otherCustomer = CustomerIdSchema.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

function orderFixture(status: OrderStatus): Order {
  return {
    id: orderId,
    customerId: owner,
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

function createOrderRepositoryFake(initial: readonly Order[]): {
  repository: OrderRepository;
  saved: Order[];
} {
  const orders = new Map(initial.map((order) => [order.id, order]));
  const saved: Order[] = [];
  const repository: OrderRepository = {
    findById: (id) => Promise.resolve(orders.get(id)),
    save: (order) => {
      orders.set(order.id, order);
      saved.push(order);
      return Promise.resolve();
    },
  };
  return { repository, saved };
}

test("自分の placed 注文はキャンセルでき、canceled で保存される", async () => {
  const { repository, saved } = createOrderRepositoryFake([orderFixture("placed")]);

  const result = await cancelOrder(
    { orderId, requestedBy: owner },
    { orderRepository: repository },
  );

  if (!result.ok) {
    throw new Error(`unexpected failure: ${result.reason}`);
  }
  expect(result.order.status).toBe("canceled");
  expect(saved).toStrictEqual([result.order]);
});

test("存在しない注文は ORDER_NOT_FOUND になる", async () => {
  const { repository } = createOrderRepositoryFake([]);

  const result = await cancelOrder(
    { orderId, requestedBy: owner },
    { orderRepository: repository },
  );

  expect(result).toStrictEqual({ ok: false, reason: "ORDER_NOT_FOUND" });
});

test("他人の注文のキャンセルは FORBIDDEN になり、何も保存しない(ルール 15.5)", async () => {
  const { repository, saved } = createOrderRepositoryFake([orderFixture("placed")]);

  const result = await cancelOrder(
    { orderId, requestedBy: otherCustomer },
    { orderRepository: repository },
  );

  expect(result).toStrictEqual({ ok: false, reason: "FORBIDDEN" });
  expect(saved).toStrictEqual([]);
});

test("キャンセル済みの注文は ALREADY_CANCELED になり、何も保存しない", async () => {
  const { repository, saved } = createOrderRepositoryFake([orderFixture("canceled")]);

  const result = await cancelOrder(
    { orderId, requestedBy: owner },
    { orderRepository: repository },
  );

  expect(result).toStrictEqual({ ok: false, reason: "ALREADY_CANCELED" });
  expect(saved).toStrictEqual([]);
});
