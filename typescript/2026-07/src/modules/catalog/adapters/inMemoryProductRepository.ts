import type { ProductId } from "../../../shared/model/productId.ts";
import type { Product } from "../model/product.ts";
import type { ProductRepository } from "../ports/productRepository.ts";

// インメモリ永続化。プロセスが生きている間だけ保持するサンプル実装であり、
// 実運用では postgresProductRepository などに置き換える(ルール 3.5)。
export function createInMemoryProductRepository(): ProductRepository {
  const products = new Map<ProductId, Product>();
  return {
    findById: (id) => Promise.resolve(products.get(id)),
    save: (product) => {
      products.set(product.id, product);
      return Promise.resolve();
    },
  };
}
