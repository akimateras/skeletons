import { expectTypeOf, test } from "vitest";
import { brand, type Brand } from "./brand.ts";

test("brand は構造的な型を保存したまま幻影タグのみを付ける", () => {
  type OrderId = Brand<string, "OrderId">;
  const id = brand<string, "OrderId">("x");
  expectTypeOf(id).toExtend<string>();
  expectTypeOf(id).toEqualTypeOf<OrderId>();
  expectTypeOf(id).not.toEqualTypeOf<Brand<string, "CustomerId">>();
});
