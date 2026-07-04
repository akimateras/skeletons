import { z } from "zod";
import { brand, type Brand } from "../../unsafe/brand.ts";

// 顧客 ID。認証境界(app)と order モジュールの両方が使うため共有カーネルに置く(ルール 4.1)。
export type CustomerId = Brand<string, "CustomerId">;

export const CustomerIdSchema = z.uuid().transform((id) => brand<string, "CustomerId">(id));
