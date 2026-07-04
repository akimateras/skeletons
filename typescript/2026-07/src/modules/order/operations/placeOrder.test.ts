import { expect, test } from "vitest";
import type { Product, ProductRepository } from "../../catalog/index.ts";
import { CustomerIdSchema } from "../../../shared/model/customerId.ts";
import { MoneySchema } from "../../../shared/model/money.ts";
import { ProductIdSchema } from "../../../shared/model/productId.ts";
import type { Order } from "../model/order.ts";
import { OrderIdSchema } from "../model/orderId.ts";
import type { Clock } from "../ports/clock.ts";
import type { OrderIdGenerator } from "../ports/orderIdGenerator.ts";
import type { OrderRepository } from "../ports/orderRepository.ts";
import { placeOrder, PlaceOrderRequestSchema, type PlaceOrderRequest } from "./placeOrder.ts";

// operations は ports のテスト用実装を注入して検証する(ルール 9.2)。
// テスト用実装も interface を完全に実装した具象として書く(ルール 9.7)。

const coffeeBeans: Product = {
  id: ProductIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  name: "コーヒー豆 200g",
  price: MoneySchema.parse(500),
};
const dripper: Product = {
  id: ProductIdSchema.parse("22222222-2222-4222-8222-222222222222"),
  name: "ドリッパー",
  price: MoneySchema.parse(250),
};
const unknownProductId = ProductIdSchema.parse("99999999-9999-4999-8999-999999999999");
const customerId = CustomerIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const fixedOrderId = OrderIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const fixedNow = new Date("2026-07-07T12:00:00.000Z");

type PlaceOrderDeps = {
  orderRepository: OrderRepository;
  orderIdGenerator: OrderIdGenerator;
  clock: Clock;
  productRepository: ProductRepository;
};

function createDeps(products: readonly Product[]): {
  deps: PlaceOrderDeps;
  savedOrders: Order[];
} {
  const savedOrders: Order[] = [];
  const orderRepository: OrderRepository = {
    findById: (id) => Promise.resolve(savedOrders.find((order) => order.id === id)),
    save: (order) => {
      savedOrders.push(order);
      return Promise.resolve();
    },
  };
  const productRepository: ProductRepository = {
    findById: (id) => Promise.resolve(products.find((product) => product.id === id)),
    save: () => Promise.resolve(),
  };
  const orderIdGenerator: OrderIdGenerator = { generate: () => fixedOrderId };
  const clock: Clock = { now: () => fixedNow };
  return {
    deps: { orderRepository, orderIdGenerator, clock, productRepository },
    savedOrders,
  };
}

// フィクスチャも公開スキーマを通して組み立てる(ルール 9.7: 型の捏造をしない)
function parseRequestLines(rawLines: unknown): PlaceOrderRequest["lines"] {
  const parsed = PlaceOrderRequestSchema.safeParse({ lines: rawLines });
  if (!parsed.success) {
    throw new Error(`invalid request fixture: ${parsed.error.message}`);
  }
  return parsed.data.lines;
}

test("注文時点の単価で合計を計算し、placed 状態で保存する", async () => {
  const { deps, savedOrders } = createDeps([coffeeBeans, dripper]);
  const lines = parseRequestLines([
    { productId: coffeeBeans.id, quantity: 2 },
    { productId: dripper.id, quantity: 1 },
  ]);

  const result = await placeOrder({ customerId, lines }, deps);

  if (!result.ok) {
    throw new Error(`unexpected failure: ${result.reason}`);
  }
  expect(result.order.id).toBe(fixedOrderId);
  expect(result.order.customerId).toBe(customerId);
  expect(result.order.status).toBe("placed");
  expect(result.order.placedAt).toBe(fixedNow);
  expect(result.order.totalAmount).toBe(1250);
  expect(result.order.lines).toStrictEqual([
    { productId: coffeeBeans.id, quantity: 2, unitPrice: 500 },
    { productId: dripper.id, quantity: 1, unitPrice: 250 },
  ]);
  expect(savedOrders).toStrictEqual([result.order]);
});

test("存在しない商品を含む注文は PRODUCT_NOT_FOUND になり、何も保存しない", async () => {
  const { deps, savedOrders } = createDeps([coffeeBeans]);
  const lines = parseRequestLines([
    { productId: coffeeBeans.id, quantity: 1 },
    { productId: unknownProductId, quantity: 1 },
  ]);

  const result = await placeOrder({ customerId, lines }, deps);

  expect(result).toStrictEqual({
    ok: false,
    reason: "PRODUCT_NOT_FOUND",
    productId: unknownProductId,
  });
  expect(savedOrders).toStrictEqual([]);
});

test("PlaceOrderRequestSchema は空の明細と不正な数量を拒否する", () => {
  expect(PlaceOrderRequestSchema.safeParse({ lines: [] }).success).toBe(false);
  expect(
    PlaceOrderRequestSchema.safeParse({
      lines: [{ productId: coffeeBeans.id, quantity: 0 }],
    }).success,
  ).toBe(false);
  expect(
    PlaceOrderRequestSchema.safeParse({
      lines: [{ productId: coffeeBeans.id, quantity: 1.5 }],
    }).success,
  ).toBe(false);
});
