import type { Money } from "../../../shared/model/money.ts";
import type { ProductId } from "../../../shared/model/productId.ts";

export type Product = {
  readonly id: ProductId;
  readonly name: string;
  readonly price: Money;
};
