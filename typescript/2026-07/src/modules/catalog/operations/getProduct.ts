import type { ProductId } from "../../../shared/model/productId.ts";
import type { Product } from "../model/product.ts";
import type { ProductRepository } from "../ports/productRepository.ts";

export async function getProduct(
  id: ProductId,
  deps: { productRepository: ProductRepository },
): Promise<Product | undefined> {
  return deps.productRepository.findById(id);
}
