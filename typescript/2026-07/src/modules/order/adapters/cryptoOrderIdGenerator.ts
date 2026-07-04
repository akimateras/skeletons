import { brand } from "../../../unsafe/brand.ts";
import type { OrderIdGenerator } from "../ports/orderIdGenerator.ts";

export function createCryptoOrderIdGenerator(): OrderIdGenerator {
  return {
    // crypto.randomUUID は常に UUID を返すため、境界での生成として
    // 検証なしのブランド化を許容する(ルール 6.6)。
    generate: () => brand<string, "OrderId">(crypto.randomUUID()),
  };
}
