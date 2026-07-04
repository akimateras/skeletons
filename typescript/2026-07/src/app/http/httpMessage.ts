// トランスポート(node:http)から独立した HTTP 入出力の表現。
// handler をプレーンなデータでテストできるようにするための薄い型で、
// body は検証前の外部入力なので unknown で受ける(ルール 6.4)。
export type HttpRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: unknown;
};

export type HttpResponse = {
  readonly status: number;
  readonly body: unknown;
};
