import { z } from "zod";
import { brand, type Brand } from "../../unsafe/brand.ts";

// 商品 ID。catalog(商品)と order(注文明細)の両方が使い、依存の向きを
// 一方向に保てないため共有カーネルに置く(ルール 4.1)。
export type ProductId = Brand<string, "ProductId">;

export const ProductIdSchema = z.uuid().transform((id) => brand<string, "ProductId">(id));
