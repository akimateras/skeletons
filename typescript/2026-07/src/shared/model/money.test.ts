import { expect, test } from "vitest";
import { addMoney, MoneySchema, multiplyMoney, zeroMoney } from "./money.ts";

test("MoneySchema は非負整数を受理する", () => {
  expect(MoneySchema.safeParse(0).success).toBe(true);
  expect(MoneySchema.safeParse(1980).success).toBe(true);
});

test("MoneySchema は負数・非整数・数値以外を拒否する", () => {
  expect(MoneySchema.safeParse(-1).success).toBe(false);
  expect(MoneySchema.safeParse(19.8).success).toBe(false);
  expect(MoneySchema.safeParse("1980").success).toBe(false);
});

test("addMoney は金額を加算する", () => {
  const a = MoneySchema.parse(100);
  const b = MoneySchema.parse(250);
  expect(addMoney(a, b)).toBe(350);
  expect(addMoney(a, zeroMoney)).toBe(100);
});

test("multiplyMoney は単価×数量を計算する", () => {
  const price = MoneySchema.parse(500);
  expect(multiplyMoney(price, 3)).toBe(1500);
  expect(multiplyMoney(price, 0)).toBe(0);
});

test("multiplyMoney は不変条件を壊す数量をプログラミングミスとして例外にする", () => {
  const price = MoneySchema.parse(500);
  expect(() => multiplyMoney(price, -1)).toThrow(RangeError);
  expect(() => multiplyMoney(price, 1.5)).toThrow(RangeError);
});
