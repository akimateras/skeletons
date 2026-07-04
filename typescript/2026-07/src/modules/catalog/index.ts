export { getProduct } from "./operations/getProduct.ts";
export {
  registerProduct,
  RegisterProductInputSchema,
  type RegisterProductInput,
} from "./operations/registerProduct.ts";
export type { Product } from "./model/product.ts";
export type { ProductIdGenerator } from "./ports/productIdGenerator.ts";
export type { ProductRepository } from "./ports/productRepository.ts";
