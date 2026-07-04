import type { ProductId } from "../../../shared/model/productId.ts";

// ID 生成は乱数への依存であり、暗黙に取得せず port として注入する(ルール 7.1)
export interface ProductIdGenerator {
  generate: () => ProductId;
}
