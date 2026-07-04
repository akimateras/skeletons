# catalog

商品カタログを提供するモジュール。商品の登録と取得を担う。

## 公開API（index.ts）

- `registerProduct` / `RegisterProductInputSchema`: 商品を登録するユースケースと、その入力スキーマ（ルール 6.7.1）
- `getProduct`: 商品を 1 件取得する。存在しない場合は `undefined`（ルール 6.5）
- `Product`: 商品エンティティ（`ProductId`・`Money` は共有カーネル `shared/model` の型）
- `ProductRepository` / `ProductIdGenerator`: このモジュールが外部に求める能力（ports）

## adapters

- `inMemoryProductRepository`: インメモリ永続化のサンプル実装。実運用では DB 実装に置き換える
- `cryptoProductIdGenerator`: `crypto.randomUUID` による ID 生成

adapters は公開入口から re-export しない。具象の生成は `main.ts` のみが行う（ルール 3.11）。
