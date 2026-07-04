import type { ProductId } from "../../../shared/model/productId.ts";
import type { Product } from "../model/product.ts";

export interface ProductRepository {
  // 存在しないことは undefined で表す(ルール 3.4・6.5)
  findById: (id: ProductId) => Promise<Product | undefined>;
  save: (product: Product) => Promise<void>;
}
