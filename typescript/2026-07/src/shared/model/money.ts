import { z } from "zod";
import { brand, type Brand } from "../../unsafe/brand.ts";

// 金額。最小通貨単位(円)の非負整数として表す(単一通貨前提)。
// catalog(商品価格)と order(注文合計)の両方が使うため共有カーネルに置く(ルール 4.1)。
export type Money = Brand<number, "Money">;

// 複数の境界(商品登録 API・注文 API)から同じ不変条件で検証するため、
// スキーマを型と同居させる(ルール 6.7.2)。
export const MoneySchema = z
  .number()
  .int()
  .nonnegative()
  .transform((amount) => brand<number, "Money">(amount));

export const zeroMoney: Money = brand<number, "Money">(0);

export function addMoney(a: Money, b: Money): Money {
  // 非負整数 + 非負整数は不変条件を保存する
  return brand<number, "Money">(a + b);
}

export function multiplyMoney(price: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    // 負・非整数の数量は業務上あり得る失敗ではなくプログラミングミスであり、
    // 例外として扱う(ルール 8.2)。
    throw new RangeError(`quantity must be a non-negative integer: ${String(quantity)}`);
  }
  return brand<number, "Money">(price * quantity);
}
