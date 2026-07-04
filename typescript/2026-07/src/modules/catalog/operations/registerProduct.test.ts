import { expect, test } from "vitest";
import { MoneySchema } from "../../../shared/model/money.ts";
import { ProductIdSchema } from "../../../shared/model/productId.ts";
import type { Product } from "../model/product.ts";
import type { ProductIdGenerator } from "../ports/productIdGenerator.ts";
import type { ProductRepository } from "../ports/productRepository.ts";
import { registerProduct, RegisterProductInputSchema } from "./registerProduct.ts";

// ports のテスト用実装は interface を完全に実装した具象として書く(ルール 9.2・9.7)
function createProductRepositoryFake(): { repository: ProductRepository; saved: Product[] } {
  const saved: Product[] = [];
  const repository: ProductRepository = {
    findById: (id) => Promise.resolve(saved.find((product) => product.id === id)),
    save: (product) => {
      saved.push(product);
      return Promise.resolve();
    },
  };
  return { repository, saved };
}

const fixedProductId = ProductIdSchema.parse("11111111-1111-4111-8111-111111111111");

const fixedIdGenerator: ProductIdGenerator = {
  generate: () => fixedProductId,
};

test("registerProduct は生成した ID で商品を保存して返す", async () => {
  const { repository, saved } = createProductRepositoryFake();

  const product = await registerProduct(
    { name: "コーヒー豆 200g", price: MoneySchema.parse(1480) },
    { productRepository: repository, productIdGenerator: fixedIdGenerator },
  );

  expect(product.id).toBe(fixedProductId);
  expect(product.name).toBe("コーヒー豆 200g");
  expect(product.price).toBe(1480);
  expect(saved).toStrictEqual([product]);
});

test("RegisterProductInputSchema は名前の空文字と不正な価格を拒否する", () => {
  expect(RegisterProductInputSchema.safeParse({ name: "", price: 100 }).success).toBe(false);
  expect(RegisterProductInputSchema.safeParse({ name: "豆", price: -1 }).success).toBe(false);
  expect(RegisterProductInputSchema.safeParse({ name: "豆", price: 100 }).success).toBe(true);
});
