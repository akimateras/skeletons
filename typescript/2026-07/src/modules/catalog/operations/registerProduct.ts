import { z } from "zod";
import { MoneySchema } from "../../../shared/model/money.ts";
import type { Product } from "../model/product.ts";
import type { ProductIdGenerator } from "../ports/productIdGenerator.ts";
import type { ProductRepository } from "../ports/productRepository.ts";

// ユースケース入力スキーマは消費する operations 側が所有し、
// app/ は import して safeParse するだけにする(ルール 6.7.1)。
export const RegisterProductInputSchema = z.object({
  name: z.string().min(1),
  price: MoneySchema,
});

export type RegisterProductInput = z.infer<typeof RegisterProductInputSchema>;

export async function registerProduct(
  input: RegisterProductInput,
  deps: {
    productRepository: ProductRepository;
    productIdGenerator: ProductIdGenerator;
  },
): Promise<Product> {
  const product: Product = {
    id: deps.productIdGenerator.generate(),
    name: input.name,
    price: input.price,
  };
  await deps.productRepository.save(product);
  return product;
}
