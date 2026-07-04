import { z } from "zod";
import { brand, type Brand } from "../../../unsafe/brand.ts";

// 注文数量。1 以上の整数のみを許す(ルール 6.6: プリミティブのまま広げない)。
export type Quantity = Brand<number, "Quantity">;

export const QuantitySchema = z
  .number()
  .int()
  .positive()
  .transform((quantity) => brand<number, "Quantity">(quantity));
