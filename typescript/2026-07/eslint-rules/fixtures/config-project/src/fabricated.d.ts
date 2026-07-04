// 宣言ファイル(.d.ts)のフィクスチャ(ルール 6.1)。
// 宣言ファイル内の宣言はすべて暗黙に ambient となり、declare キーワードなしで
// 型を捏造できるため、ファイルごと禁止されることを検証する。

export const fabricated: { secret: string };
