// ports/(ルール 6.8.1)のフィクスチャ。能力契約の interface が緩和される。
// 関数メンバーはプロパティ構文で書く(ルール 6.8.4)。

export interface AlphaPort {
  find: (id: string) => Promise<string | undefined>;
}

// メソッド構文はパラメータが双変検査されるため、ports/ でも禁止(ルール 6.8.4)。
// このファイルの method-signature-style 違反はこの 1 件のみであることを
// eslint-config.test.ts が件数で固定する(プロパティ構文が許可される証明を兼ねる)。
export interface BivariantPort {
  find(id: string): Promise<string | undefined>;
}
