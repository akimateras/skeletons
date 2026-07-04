import { expect, test } from "vitest";
import { MoneySchema } from "../../../shared/model/money.ts";
import { ProductIdSchema } from "../../../shared/model/productId.ts";
import type { Product } from "../model/product.ts";
import { createInMemoryProductRepository } from "./inMemoryProductRepository.ts";

// adapter が port の契約を満たすことを検証する(ルール 9.3)

const productId = ProductIdSchema.parse("11111111-1111-4111-8111-111111111111");

function productFixture(name: string): Product {
  return { id: productId, name, price: MoneySchema.parse(1480) };
}

test("保存していない ID の findById は undefined を返す", async () => {
  const repository = createInMemoryProductRepository();
  expect(await repository.findById(productId)).toBeUndefined();
});

test("save した商品を findById で取得できる", async () => {
  const repository = createInMemoryProductRepository();
  const product = productFixture("コーヒー豆 200g");

  await repository.save(product);

  expect(await repository.findById(productId)).toStrictEqual(product);
});

test("同じ ID で save すると上書きされる", async () => {
  const repository = createInMemoryProductRepository();

  await repository.save(productFixture("旧名称"));
  await repository.save(productFixture("新名称"));

  const found = await repository.findById(productId);
  if (found === undefined) {
    throw new Error("saved product must be found");
  }
  expect(found.name).toBe("新名称");
});
