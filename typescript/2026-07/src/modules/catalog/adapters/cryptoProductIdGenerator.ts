import { brand } from "../../../unsafe/brand.ts";
import type { ProductIdGenerator } from "../ports/productIdGenerator.ts";

export function createCryptoProductIdGenerator(): ProductIdGenerator {
  return {
    // crypto.randomUUID は常に UUID を返すため、境界での生成として
    // 検証なしのブランド化を許容する(ルール 6.6)。
    generate: () => brand<string, "ProductId">(crypto.randomUUID()),
  };
}
