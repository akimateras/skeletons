import { z } from "zod";
import { brand, type Brand } from "../../../unsafe/brand.ts";

export type OrderId = Brand<string, "OrderId">;

export const OrderIdSchema = z.uuid().transform((id) => brand<string, "OrderId">(id));
