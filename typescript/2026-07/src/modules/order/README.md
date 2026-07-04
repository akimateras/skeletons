# order

注文を提供するモジュール。注文の作成（placeOrder）とキャンセル（cancelOrder）を担う。

## 公開API（index.ts）

- `placeOrder` / `PlaceOrderRequestSchema`: 注文を作成するユースケースと、そのリクエスト本文スキーマ（ルール 6.7.1）。
  実行主体（`customerId`）は認証情報から渡すためスキーマには含めない
- `cancelOrder`: 注文をキャンセルするユースケース。「自分の注文のみキャンセルできる」という認可判定を operations で行う（ルール 15.5）
- `Order` / `OrderLine` / `OrderStatus`: 注文エンティティと状態（`placed | shipped | canceled`）
- `OrderIdSchema`: パスパラメータ等の外部入力を `OrderId` へ検証・変換するスキーマ
- `OrderRepository` / `OrderIdGenerator` / `Clock`: このモジュールが外部に求める能力（ports）。
  時刻・乱数も port 経由で注入する（ルール 7.1）

## 設計メモ

- 明細の単価は注文時点の商品価格を固定して保持する。商品価格の変更は既存の注文に影響しない
- 状態遷移は `model/markOrderCanceled.ts` に閉じ、operations は遷移関数を呼ぶだけにする（ルール 14.1・14.2）
- 商品情報が必要なため catalog モジュールへ依存する。他モジュールへの依存は operations のみ・
  公開入口経由という制約に従う（ルール 4.1）

## adapters

- `inMemoryOrderRepository`: インメモリ永続化のサンプル実装。実運用では DB 実装に置き換える
- `cryptoOrderIdGenerator` / `systemClock`: 乱数・時刻という副作用源の具象実装

adapters は公開入口から re-export しない。具象の生成は `main.ts` のみが行う（ルール 3.11）。
