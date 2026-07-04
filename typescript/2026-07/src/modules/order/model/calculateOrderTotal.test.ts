import { expect, test } from "vitest";
import { MoneySchema } from "../../../shared/model/money.ts";
import { ProductIdSchema } from "../../../shared/model/productId.ts";
import { calculateOrderTotal } from "./calculateOrderTotal.ts";
import type { OrderLine } from "./order.ts";
import { QuantitySchema } from "./quantity.ts";

// テストデータはファクトリ関数で組み立てる(ルール 9.7)。
// フィクスチャの不正は .parse の throw でテストの失敗として顕在化させる。
function orderLineFixture(input: { productId: string; quantity: number; unitPrice: number }): OrderLine {
  return {
    productId: ProductIdSchema.parse(input.productId),
    quantity: QuantitySchema.parse(input.quantity),
    unitPrice: MoneySchema.parse(input.unitPrice),
  };
}

test("明細ごとの単価×数量の総和を返す", () => {
  const lines = [
    orderLineFixture({
      productId: "11111111-1111-4111-8111-111111111111",
      quantity: 2,
      unitPrice: 500,
    }),
    orderLineFixture({
      productId: "22222222-2222-4222-8222-222222222222",
      quantity: 1,
      unitPrice: 250,
    }),
  ];

  expect(calculateOrderTotal(lines)).toBe(1250);
});

test("明細が空なら 0 を返す", () => {
  expect(calculateOrderTotal([])).toBe(0);
});
