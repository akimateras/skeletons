// テストファイル(*.test.ts)にも同一の型規律が適用される(ルール 9.7)ことの
// フィクスチャ。テスト向けの緩和 override が誤って追加された場合に検出する。

export const forgedInTest = { length: 1 } as { length: number };
