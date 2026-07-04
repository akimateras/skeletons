import { addMoney, multiplyMoney, zeroMoney, type Money } from "../../../shared/model/money.ts";
import type { OrderLine } from "./order.ts";

// 金額計算は外部 I/O から独立した純粋関数として model に置く(ルール 3.2・9.1)
export function calculateOrderTotal(lines: readonly OrderLine[]): Money {
  return lines.reduce(
    (total, line) => addMoney(total, multiplyMoney(line.unitPrice, line.quantity)),
    zeroMoney,
  );
}
