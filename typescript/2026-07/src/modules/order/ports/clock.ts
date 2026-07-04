// 現在時刻は副作用源であり、暗黙に取得せず port として注入する(ルール 7.1)
export interface Clock {
  now: () => Date;
}
