# 開発ガイドライン

## 1. この文書の目的

この文書は、TypeScriptで構築する本プロジェクトのアーキテクチャルールを定める。

本プロジェクトでは、人間のエンジニアだけでなく、コーディングエージェントも継続的に設計・実装・修正に参加する。そのため、コードは「人間が読める」だけでなく、「AIが安全に理解し、変更し、検証しやすい」構造でなければならない。

### 1.1 前提環境

本ルールは以下を前提とする。

- **TypeScript 5.8 以上**
- 言語・モジュール設定は `target: es2025`・`module: esnext`・`moduleResolution: bundler` を前提とする。tsc は型検査（`noEmit`）のみを担い、ビルド・実行はツールチェーン側（バンドラ・dev server 等）に委ねる。
- `tsconfig.json` で次を有効にする:
  - `strict`
  - `noUncheckedIndexedAccess`: 配列・Record のインデックスアクセスに `undefined` を含める。「存在しないことは `undefined` で表す」方針（→ [6.5](#65-null-は使わず-undefined-を使う)）を型レベルで徹底するために必須とする。
  - `exactOptionalPropertyTypes`: 「プロパティが無いこと」と「`undefined` が代入されていること」を区別する。`undefined` 中心の設計で両者の混同によるバグを防ぐ。
  - `erasableSyntaxOnly`: `enum` の禁止（→ [6.9](#69-列挙は-enum-ではなく-union-で表す)）をコンパイラレベルでも強制する。
- 外部入力の実行時検証には **Zod 4** を使う。本文のコード例は Zod 4 の API を前提とする。

### 1.2 Zod は準標準ライブラリとして扱う

本プロジェクトでは、Zod を TypeScript 本体に準じる**準標準ライブラリ**とみなす。Zod の `parse` は純粋・決定的で副作用を持たず、3.2 が `model/` から締め出す I/O・インフラ（HTTP、DB、ORM、外部API SDK、UI、MQ、FS、env、時刻、乱数）のいずれにも該当しない。

したがって、Zod スキーマの**定義**は、依存規則（4節）が許す範囲であれば `model/` を含むどの領域に置いてもよい。「外部ライブラリを中心に持ち込まない」という一般的な直感の例外として、Zod のみを明示的に許可する。スキーマの具体的な配置基準は 6.7 に定める。

ただし、この緩和には次のガードレールを課す。

1. **緩和対象は Zod に限る。** 他の検証ライブラリを同じ扱いにしてはならず、スキーマ定義ファイルに DB・HTTP・外部SDK 等の I/O を持ち込んではならない。スキーマは純粋なままとする。
2. **未検証の外部生データの検証（`.safeParse()`、→ [6.4](#64-外部入力は実行時にも検証する)）は境界でのみ行う**（`app/`・`adapters/`・`config/`）。スキーマを `model/` に**定義**できることと、`model/` で外部生データを**受け付ける**ことは別問題であり、6.4 の「外部入力は境界で検証する」原則は不変とする。
3. **`type-guards/` を外部入力の検証手段に使わない**（3.6）ことも従来どおりとする。

## 2. 基本原則

本プロジェクトの設計では、次の原則を優先する。

1. **変更範囲を小さく保つ**
   ひとつの変更が影響するファイル、モジュール、テストの範囲をできる限り限定する。

2. **境界を明示する**
   何がどこに属するか、どの方向に依存してよいか、どのコードがどの責務を持つかを曖昧にしない。

3. **中心となるルールを安定させる**
   ビジネス上の不変条件、権限、状態遷移、金額計算、重要な判定ロジックなどは、UI、DB、HTTP、外部API、ジョブ実行基盤などから独立して理解できる場所に置く。

4. **副作用を外側に寄せる**
   DB更新、HTTP通信、ファイルI/O、時刻取得、乱数生成、環境変数参照、ログ出力、メッセージ送信などの副作用は、明示的な境界の外側で扱う。

5. **型安全性を機械的に守る**
   型システムを迂回する記述（→ [6.1](#61-禁止される型迂回記述型破壊記述)）は原則として禁止する。例外は専用ディレクトリに隔離し、レビュー対象を明確にする。

6. **機械的に検証できる契約を増やす**
   型、スキーマ、テスト、Lint、静的解析、依存ルールにより、設計違反をレビュー時ではなく実行前に検出する。

7. **意図をコードの近くに残す**
   なぜその構造にしたのか、なぜ別案を採用しなかったのかを、必要な範囲でリポジトリ内に記録する。

8. **AIが局所的に判断できる構造にする**
   変更対象を理解するために巨大な文脈を必要としないよう、モジュール、型、テスト、ドキュメントを近接させる。

## 3. プロジェクト構造

標準的な構成は次の形を基本とする。

```text
src/
  modules/
    <module-name>/
      model/
      operations/
      ports/
      adapters/
      type-guards/
      index.ts
      README.md
  shared/
    model/
    type-guards/
    utils/
    errors/
    validation/
  unsafe/
  app/
    http/
    jobs/
    cli/
    workers/
  config/
  main.ts
```

モジュール内のディレクトリ名・ファイル名は、上記の決められた語彙から選ばなければならない。ただし、すべてのモジュールがすべての構成要素を持つ必要はなく、不要な領域は作らない。例えば、明示的な Type Guard が不要なモジュールに `type-guards/` を置かず、外部操作を持たないモジュールに `ports/`・`adapters/` を置かない。`README.md` も基本的には置くことが望ましいが、公開入口（`index.ts`）を読めば足りる小さなモジュールでは省略してよい。

各ディレクトリが依存してよい方向は4節にまとめて定義する。本節では各領域の**責務**のみを述べる。

### 3.1 `modules/`

業務上のまとまりを表す単位を置く。

例:

```text
modules/
  billing/
  account/
  notification/
  inventory/
```

モジュールは、外部から見たときに「何を提供するか」が明確でなければならない。

モジュールの内部構造は、原則として外部モジュールから直接参照しない。外部に公開する型や関数は、モジュールの公開入口（`index.ts`）から明示的にexportする。詳細は5節。

### 3.2 `model/`

そのモジュールの中心的な概念、値、状態、ルールを置く。

ここには、次のようなものを含める。

- 値オブジェクト
- エンティティ相当のデータ構造
- ドメインイベント
- 状態遷移ルール
- ビジネス上の不変条件
- 純粋関数として表現できる判定・計算

`model/` が依存してよい対象は4節に定義する（要約: 同一モジュールの `type-guards/`、`shared`、`unsafe` のみ）。特に、HTTP・DB・ORM・外部API SDK・UI・メッセージキュー・ファイルシステム・環境変数・現在時刻・乱数といった**技術基盤や副作用源に一切依存してはならない**。

### 3.3 `operations/`

ユースケース、アプリケーション操作、ワークフローを置く。

例:

```text
createInvoice
cancelSubscription
registerUser
sendPasswordResetEmail
```

`operations/` は、入力を受け取り、必要なルールを呼び出し、必要な外部操作を抽象（`ports/`）経由で実行し、結果を返す。

`operations/` は具体的なDB、HTTP、外部API SDKに直接依存してはならない。外部操作が必要な場合は `ports/` に定義されたインターフェースに依存する（→ [7.2](#72-外部操作は-ports-経由で扱う)）。

認可（誰がこの操作を実行してよいか）の判定は、原則として `operations/` で行う。判定に必要な権限情報は入力または `deps` として渡し、`app/` で暗黙に済ませない（→ [15.5](#155-認可)）。

### 3.4 `ports/`

モジュールが必要とする外部能力を型として定義する。

例:

```ts
export interface InvoiceRepository {
  findById: (id: InvoiceId) => Promise<Invoice | undefined>;
  save: (invoice: Invoice) => Promise<void>;
}

export interface PaymentGateway {
  charge: (input: ChargeInput) => Promise<ChargeResult>;
}
```

`ports/` は「このモジュールが外部に何を求めるか」を表す。特定のライブラリやサービスの都合をここに漏らしてはならない。

`ports/` の型は `model/` と `shared` の型で記述する（4節）。

戻り値で「存在しない」ことを表す場合は、`undefined` を使う。`null` は使用しない（→ [6.5](#65-null-は使わず-undefined-を使う)）。

外部操作で業務上起こり得る失敗（決済拒否、在庫競合など）は、port の戻り値型で表現する（→ [8.4](#84-ports-の失敗契約)）。

### 3.5 `adapters/`

`ports/` で定義された外部能力を、具体的な技術で実装する。

例:

```text
adapters/
  postgresInvoiceRepository.ts
  stripePaymentGateway.ts
  sendgridMailer.ts
```

`adapters/` は、DB、HTTPクライアント、外部SDK、ファイルシステム、キュー、キャッシュなどに依存してよい。

ただし、`adapters/` の都合を `model/` や `operations/` に漏らしてはならない。

外部システムから得た値は、実行時スキーマで検証してから内部型に変換する。型アサーションで内部型に見せかけてはならない（→ [15.2](#152-db境界)・[15.3](#153-外部api境界)）。

外部システムとの境界表現に限り、`adapters/` では `null` の型・値の使用を許可する（→ [6.5](#65-null-は使わず-undefined-を使う)）。

外部SDKが投げる例外のうち業務上起こり得る失敗は、port の戻り値型へ変換する（→ [8.4](#84-ports-の失敗契約)）。

### 3.6 `type-guards/`

`src/modules/**/type-guards` は、どうしても明示的なType Guard関数が必要な場合にのみ使う例外領域である。

共有カーネル（`shared/model`、→ [4.1](#41-モジュール間の依存方向)）の型に対して明示的な Type Guard が必要な場合は、同じ位置付けの `shared/type-guards/` に置く。本節の規律と優先順位は `shared/type-guards/` にもそのまま適用する。`shared/type-guards/` が依存してよい対象は `shared/model` と `unsafe` に限る（→ [4](#4-依存方向のルール)）。

このディレクトリでは、明示的な型述語、すなわち `value is SomeType` の使用のみを許可する。[6.1](#61-禁止される型迂回記述型破壊記述) に挙げるその他の型迂回記述は、`type-guards/` 内でも禁止する。

アサーション関数（`asserts value is SomeType`）は、`type-guards/` 内でも許可しない。throw による型の絞り込みは「予期される失敗は結果型で返す」というエラー設計（→ [8.1](#81-予期される失敗はタグ付きunionの結果型で返す)）と両立せず、呼び出し側の制御フローを暗黙に変えるためである。

`type-guards/` は型破壊の可能性があるコードを見つけやすくするための隔離領域であり、通常の判定関数を置く場所ではない。

Type Guardが必要になったときの優先順位は次の通りとする。

1. 型設計によりType Guard自体を不要にする
2. TypeScriptの推論で型が絞り込まれる通常の判定関数にする
3. 実行時スキーマで検証する
4. それでも必要な場合のみ `type-guards/` に明示的なType Guardを置く

`type-guards/` に置く関数は、原則として純粋関数でなければならない。DB、HTTP、外部API、環境変数、現在時刻、乱数、ログ出力に依存してはならない。

`type-guards/` の関数は、外部入力の検証手段として使ってはならない。外部入力には実行時スキーマを使う（→ [6.4](#64-外部入力は実行時にも検証する)）。

### 3.7 `unsafe/`

`src/unsafe` は、TypeScript組み込み機能だけでは表現しにくい型ユーティリティを定義するための例外領域である。

このディレクトリでは、[6.1](#61-禁止される型迂回記述型破壊記述) の型迂回記述の一部使用を許可する。ただし、目的は型安全性を壊すことではなく、型システムの限界を局所的に補うことである。

`src/unsafe` は、**厳しいレビューが要求される代わりに、TypeScriptのコア言語機能の不足部分を自前で実装する**位置付けの領域である。このため依存方向は非対称になる。`src/unsafe` から他のディレクトリへの依存は一切禁止する一方、他の領域から `src/unsafe` への依存は、どの領域からも許可する（→ [4](#4-依存方向のルール)）。

`src/unsafe` に置いてよいもの:

- 汎用的なブランド型補助
- 厳密なオブジェクト型を表す型補助
- 型レベルの変換ユーティリティ
- TypeScriptの表現力不足を補う小さな補助関数
- 型テスト用の補助

`src/unsafe` に置いてはならないもの:

- 業務ルール
- モジュール固有の型
- DB、HTTP、外部API、環境変数に関わるコード
- 現在時刻・乱数・I/O などの副作用を読むコード（`Date.now()`・`Math.random()`・`fetch`・`console` などのグローバル参照。`unsafe/` はどの領域からも依存されうるため、ここに副作用を置くと純粋領域（→ [4.2](#42-外部パッケージへの依存)）が副作用を読む迂回路になる）
- 実行時のバリデーション回避
- 外部入力を内部型に見せかける変換
- `unknown` や外部レスポンスを検証なしで任意の型へ変換する関数

なお、**モジュール固有の unsafe 領域（`modules/<module-name>/unsafe` など）は設けない**。`unsafe` から `modules/*` への依存禁止により、業務型を検証なしに捏造する変換（→ [3.7.1](#371-典型的なアンチパターン-汎用キャストの再輸出) の例4）は現在、レビュー以前に**構造的に不可能**である（unsafe な領域は業務型を import できない）。モジュール固有の unsafe はこの機械的保証を失わせ、レビューだけが歯止めの領域をモジュール数だけ増やす。モジュール固有の型操作が必要に見える場合は、型パラメータで一般化した核を `src/unsafe` に置き、モジュール側でそれを型安全に合成する（`Brand<T, B>` と各モジュールの ID 型の関係が典型例、→ [6.6](#66-id金額日時などはプリミティブのまま広げない)）。一般化できない場合に必要なのは、たいてい unsafe ではなく、型設計の見直し・`type-guards/` の型述語・境界での実行時検証（→ [6.4](#64-外部入力は実行時にも検証する)）のいずれかである。

#### 3.7.1 典型的なアンチパターン: 汎用キャストの再輸出

通常領域で `as` が禁止されているため、`src/unsafe` に「便利な」キャスト関数を置いて禁止を迂回したくなる誘惑が生じる。**これは `src/unsafe` の目的の正反対であり、名前や意図にかかわらず禁止する。** 以下はすべて、`as` を関数に包んでプロジェクト全域へ再輸出しているだけである。

```ts
// すべて禁止の例。

// 1. 任意の型から任意の型へのキャスト（`as` の完全な再発明）
export function usefulCast<T, U>(value: T): U {
  return value as unknown as U;
}

// 2. unknown・外部データを、呼び出し側が選んだ型に見せかける
//    （6.4 の実行時検証の迂回）
export function parseAs<T>(text: string): T {
  return JSON.parse(text) as T;
}

// 3. 非nullアサーション `!` の言い換え（実行時には何も保証しない）
export function definitely<T>(value: T | undefined): T {
  return value as T;
}

// 4. 業務型の捏造（Invoice は modules/billing の業務型）。
//    スマートコンストラクタの不変条件を型の嘘で迂回するうえ、
//    unsafe -> modules の依存自体が 4節違反
export function asInvoice(row: Record<string, unknown>): Invoice {
  return row as Invoice;
}
```

機械的な判定基準: **入力に対して実行時に確かめていない、入力より強い型の主張を返す関数を export してはならない。** 典型的な形は次の2つである。

1. 戻り値にしか現れない型パラメータを呼び出し側が自由に選べる（例1・2・4）。これは関数の形をした `as` である。
2. 入力型から Union の一部（`| undefined` など）を検証なしに削って返す（例3）。

対比として、`brand<T, B>`（→ [6.6](#66-id金額日時などはプリミティブのまま広げない)）も `B` を呼び出し側が選ぶが、`B` は幻影タグを付けるだけで、値の構造的な型は入力の `T` のまま保存される。`src/unsafe` に置いてよいのは、このように**型レベルの主張が狭く特定されていて、型テスト（→ [9.5](#95-unsafe-は型テストを持つ)）で検証できる**ユーティリティに限る。

なお、`src/unsafe` では `as` の Lint が緩和されているため（→ [6.1](#61-禁止される型迂回記述型破壊記述)）、上記のアンチパターンは機械的には検出されない。だからこそ `src/unsafe` への追加は必ずレビューで判定基準に照らして確認する。迷った場合は 9.5 の観点「`unknown` を任意型へ変換する抜け道になっていないか」で判定する。抜け道になっているなら、必要なのはキャストではなく、境界での実行時検証（→ [6.4](#64-外部入力は実行時にも検証する)）か型設計の見直しである。

### 3.8 `app/`

HTTPルーティング、CLI、ジョブ、ワーカーなど、アプリケーションの起動点や入出力面を置く。

- `http/`: HTTPリクエストを受ける入口
- `cli/`: コマンドライン実行の入口
- `jobs/`: スケジュール実行・単発バッチなど、時間駆動で起動する処理
- `workers/`: キュー・イベント購読など、メッセージ駆動で起動する処理

`app/` は入力を受け取り、バリデーションし、認可情報を取り出し、適切な `operations/` を呼び出し、結果を外部表現へ変換する。

`app/` にビジネスルールを書いてはならない。

### 3.9 `shared/`

複数のモジュールから使う汎用部品を置く。可否の基準は12節に定義する。要点として、`shared/` は便利な置き場ではなく、特定モジュールの業務知識を含むコードを置いてはならない。

### 3.10 `config/`

環境変数や設定ファイルを読み込み、実行時スキーマで検証し、型付けされた設定オブジェクトへ変換する責務を持つ（→ [15.4](#154-環境変数境界)）。

`config/` は設定値の**供給**のみを担い、業務ルールを持たない。アプリケーションの任意の場所から `process.env` を直接参照してはならず、必ず `config/` を経由する。

### 3.11 `main.ts`（コンポジションルート）

`main.ts` は本プロジェクトで唯一のコンポジションルートである。ここでのみ、次を行う。

- `config/` から設定を読み込む
- `adapters/` の具象を生成する
- 具象を `ports/` の型として `operations/` や `app/` の起動処理へ注入（配線）する

**`adapters/` の具象を生成・配線してよいのは `main.ts`（および `main.ts` が呼び出す起動用の配線コード）に限る。** `operations/`、`app/` のハンドラ本体、`model/` は具象を生成せず、常に `ports/` の型を受け取る。この一点集約により、依存グラフの他のすべての領域を具象非依存に保つ。

## 4. 依存方向のルール

依存は原則として次の方向にのみ流れる。左辺の領域は、右辺に列挙した領域にのみ依存してよい。

なお、モジュール外（`app/`・`main.ts`・他モジュール）から `modules/*` 内の各領域への参照は、下表で許可されている場合でも、すべて公開入口（`index.ts`）を経由する（→ [5.2](#52-モジュール外から内部実装を参照しない)）。唯一の例外は、`main.ts`（および配線コード）が具象を生成するための `adapters/` への直接参照である。

```text
main.ts (コンポジションルート)
  -> config
  -> app
  -> modules/*/operations
  -> modules/*/adapters      # 具象生成はここでのみ
  -> modules/*/ports
  -> shared
  -> unsafe

app
  -> modules/*/operations
  -> modules/*/model
  -> modules/*/ports
  -> modules/*/type-guards
  -> shared
  -> config
  -> unsafe

modules/*/operations
  -> modules/*/model
  -> modules/*/ports
  -> modules/*/type-guards
  -> shared
  -> unsafe

modules/*/adapters
  -> modules/*/ports
  -> modules/*/model
  -> modules/*/type-guards
  -> shared
  -> unsafe

modules/*/ports
  -> modules/*/model
  -> shared
  -> unsafe

modules/*/type-guards
  -> modules/*/model
  -> shared
  -> unsafe

modules/*/model
  -> modules/*/type-guards
  -> shared
  -> unsafe

shared/type-guards
  -> shared/model
  -> unsafe

shared (type-guards を除く)
  -> unsafe

config
  -> shared
  -> unsafe

unsafe
  -> 依存なし
```

`unsafe` の依存方向は意図的に非対称である。`unsafe` は「厳しいレビューが要求される代わりに、TypeScriptのコア言語機能の不足部分を自前で実装する」領域であり（→ [3.7](#37-unsafe)）、言語機能の延長として **どの領域からも依存してよい**。逆に、`unsafe` から他の領域への依存は一切禁止する。

禁止される依存の例:

```text
model      -> operations
model      -> ports
model      -> adapters
model      -> app
operations -> adapters
app        -> adapters        # 具象は main.ts で注入する
shared     -> modules/*
config     -> modules/*
unsafe     -> modules/*
unsafe     -> shared
unsafe     -> app
unsafe     -> config
```

### 4.1 モジュール間の依存方向

上記はモジュール**内**の依存規則である。モジュール**間**の依存は、次の規則に従う。

- モジュール間の依存は、必ず相手モジュールの公開入口（`index.ts`）経由で行う（→ [5.2](#52-モジュール外から内部実装を参照しない)）。
- **モジュール内部で他モジュールへ依存してよいのは `operations/` のみ**とする（モジュール外からは `app/` と `main.ts`）。`model/`・`ports/`・`adapters/`・`type-guards/` から他モジュールへ依存してはならない。これらの領域で他モジュールの型が必要になった場合は、共有カーネル（`shared/model`）への移動、または `operations/` での調停（→ [5.3](#53-モジュール間の直接依存は最小化する)）を検討する。
- **モジュール間に循環依存を作ってはならない。** モジュール群は有向非循環（DAG）でなければならない。
- 複数モジュールが共有する ID・値オブジェクト（例: `CustomerId`）は、依存の向きを一方向に保てない場合、`shared/model`（共有カーネル）に置く。共有カーネルには業務ロジックを持たない純粋な型・値のみを置く。
- あるモジュールが別モジュールの内部状態に強く依存し始めた場合は、境界の誤りを疑う（→ [5.3](#53-モジュール間の直接依存は最小化する)）。

### 4.2 外部パッケージへの依存

npm パッケージ・Node 組み込みモジュールへの依存も、領域ごとに制限し、dependency-cruiser で機械的に強制する（具体的な定義は `.dependency-cruiser.cjs` を唯一の真実とする、→ [10](#10-機械的な強制)）。

- **純粋領域**（`modules/*/model`・`operations`・`ports`・`type-guards`、および `shared/`）が依存してよい外部パッケージは **Zod のみ**とする（→ [1.2](#12-zod-は準標準ライブラリとして扱う)）。Node 組み込みモジュールにも依存してはならない。
- **境界領域**（`app/`・`config/`・`modules/*/adapters`・`main.ts`）は、外部パッケージ・Node 組み込みモジュールに依存してよい。
- **`unsafe/`** は外部パッケージ・Node 組み込みモジュールにも一切依存しない（4節の「依存なし」は外部依存を含む）。
- **テストファイル**（`*.test.ts` / `*.test-d.ts`）は、所属領域の上記制限に加えて、テストランナー（vitest）へ依存してよい。逆に、テストファイル以外の本体コードからテストファイルへ依存してはならない。

## 5. モジュール境界

### 5.1 モジュールは業務概念で分ける

モジュールは技術別ではなく、業務上の関心ごとで分ける。

望ましい例:

```text
modules/billing
modules/account
modules/notification
```

避ける例:

```text
modules/controllers
modules/services
modules/repositories
modules/types
```

技術別の分類は、責務が拡散しやすく、AIも人間も変更範囲を誤認しやすい。

### 5.2 モジュール外から内部実装を参照しない

各モジュールは公開入口 `index.ts` を持つ。他モジュールだけでなく、**`app/` および `main.ts` からの参照も**、原則としてこの公開入口からのみ行う。唯一の例外は、`main.ts`（および配線コード）が具象を生成するために `adapters/` を直接参照する場合である（→ [3.11](#311-maintsコンポジションルート)）。

禁止例:

```ts
import { calculateInvoiceTotal } from "../billing/model/calculateInvoiceTotal.ts";
```

許可例:

```ts
import { calculateInvoiceTotal } from "../billing/index.ts";
```

（相対 import では、ディレクトリ参照ではなく `index.ts` まで拡張子付きで明示する。ツールによって `index` 解決の挙動が異なる余地を残さず、公開入口を参照していることをコード上で一意にするためである。）

ただし、同一モジュール内の参照ではこの限りではない。

また、公開入口（`index.ts`）から `adapters/` を再エクスポートしてはならない。具象へ到達してよいのは `main.ts`（および配線コード）の直接参照のみである（→ [3.11](#311-maintsコンポジションルート)）。

### 5.3 モジュール間の直接依存は最小化する

あるモジュールが別モジュールの内部状態に強く依存し始めた場合、境界が誤っている可能性がある。

モジュール間連携では、次を優先する。

1. 公開された型・関数を使う
2. イベントやメッセージで連携する
3. 上位の `operations/` で複数モジュールを調停する
4. それでも複雑ならモジュール境界を見直す

## 6. 型とスキーマ

### 6.1 禁止される型迂回記述（型破壊記述）

プロジェクト全体で、次の記述を禁止する。以下を本文中では**「型迂回記述」**と呼び、他セクションからはこの一覧を参照する。

- 明示的な `any`
- unsafe assignment / unsafe argument / unsafe call / unsafe member access / unsafe return
- `as` 型アサーション（例外: `as const`）
- `<T>value` 形式の型アサーション
- 非nullアサーション `!`
- definite assignment assertion（`let x!: T`、クラスフィールドの `x!: T`。宣言側の `!` による初期化検査の無効化）
- クラスフィールドの `declare` 修飾子（`declare x: T`。初期化検査を無効化し、実行時の裏付けなしに型を宣言できる。definite assignment assertion と同等の型捏造）
- 明示的な型述語 `value is SomeType`（アサーション関数 `asserts value is SomeType` を含む）
- 関数・メソッドのオーバーロード宣言（実装を持たないシグネチャの並記。TypeScript のオーバーロード整合性検査は緩く、宣言シグネチャが実装より強い型を主張できるため、非nullアサーション等を再発明する抜け道になる）
- `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`
- ESLint無効化コメント
- ambient 宣言（`declare const` / `declare function` / `declare class` / `declare module` / `declare global` / `declare namespace`。実行時の裏付けなしに型を宣言でき、`declare module` / `declare global` は宣言マージ（→ [6.8.3](#683-宣言マージに依存しない)）の侵入口になる）
- 宣言ファイル（`.d.ts`）。宣言ファイル内の宣言は**すべて暗黙に ambient** となり、`declare` キーワードを書かずに前項の ambient 宣言と同じ型捏造ができる（`export const x: T;` が合法になる）。個別の宣言ではなくファイル自体を、`unsafe/` を含む全域で禁止する
- `null` 型および `null` 値

例外は次の3領域に限る。

1. `src/modules/**/type-guards` および `src/shared/type-guards` では、**明示的な型述語 `value is SomeType` のみ**許可する。アサーション関数（`asserts value is SomeType`）はここでも許可しない（→ [3.6](#36-type-guards)）。
2. `src/unsafe` では、**型ユーティリティを定義する目的に限って**、型アサーション・型レベルの `any`・値の ambient 宣言・オーバーロード宣言の使用を許可する（位置付けは → [3.7](#37-unsafe)）。
3. `src/modules/**/adapters` では、**外部システムとの境界表現に限って `null` の型・値**の使用を許可する（→ [6.5](#65-null-は使わず-undefined-を使う)）。

また、`src/` の外にある Lint 基盤（`eslint-rules/`、→ [10.2](#102-自作ルールeslint-rules)）は、アプリケーションコードではなく、TypeScript コンパイラの内部 API や eslint 本体との型相互運用を扱うため、本節の禁止を含む ESLint の検査対象から除外する。

例外領域であっても、使用目的を逸脱してはならない。機械的な強制方法は10節に定義する。

### 6.2 `as` の代わりに `satisfies` を使う

型の適合を確認しつつリテラルの推論を保ちたい場合は、`as` ではなく `satisfies` 演算子を使う。`satisfies` は型を弱めず、値の実型を保持したまま指定した型への適合のみを検査するため、`as` のような型破壊を伴わない。

避ける例:

```ts
const config = { retries: 3, mode: "fast" } as RetryConfig;
```

望ましい例:

```ts
const config = { retries: 3, mode: "fast" } satisfies RetryConfig;
```

定数を絞り込む用途では `as const` を併用してよい。

### 6.3 境界を越えるデータは型で明示する

外部入力、外部出力、DB読み書き、外部API通信、ジョブペイロード、イベントペイロードは、明示的な型を持たなければならない。

```ts
export type CreateInvoiceInput = {
  customerId: CustomerId;
  items: InvoiceItemInput[];
};
```

### 6.4 外部入力は実行時にも検証する

TypeScriptの型はコンパイル時の制約であり、外部入力の正当性を保証しない。

HTTP request、Webhook、環境変数、外部APIレスポンス、DBから復元した値、JSON、CLIツールの出力、キューメッセージなどは、実行時スキーマで検証する。

外部入力の検証には原則としてZodなどのスキーマバリデーションを使う。型アサーションやType Guardで外部入力を内部型に変換してはならない。

`unknown` を外部境界の受け皿にし、検証または明示的な変換を通過するまで内部ロジックへ渡さない。

**境界での検証は `.safeParse()` を標準とする。** 外部入力の不正は業務上あり得る失敗（→ [8.1](#81-予期される失敗はタグ付きunionの結果型で返す)）であり、`.parse()` の throw で例外経路（→ [8.2](#82-例外は予期しない異常に限定する)）へ流してはならない。検証失敗は、結果型またはエラーレスポンス（HTTPなら 400 相当）へ明示的に変換する。

唯一の例外は `config/` の**起動時**検証である。環境変数・設定の不正は業務上あり得る失敗ではなく、デプロイ・設定の誤りによる予期しない異常（→ [8.2](#82-例外は予期しない異常に限定する)）として扱い、フェイルファストしてよい（→ [15.4](#154-環境変数境界)）。

禁止例:

```ts
function createInvoice(input: unknown) {
  return calculate(input.items);
}
```

望ましい例:

```ts
const parsed = CreateInvoiceInputSchema.safeParse(rawInput);
if (!parsed.success) {
  return toValidationErrorResponse(parsed.error);
}
return createInvoice(parsed.data, deps);
```

### 6.5 `null` は使わず `undefined` を使う

値が存在しないことを表す場合は、原則として `undefined` を使う。

禁止例:

```ts
type FindUserResult = User | null;
```

望ましい例:

```ts
type FindUserResult = User | undefined;
```

外部APIやDBが `null` を返す場合は、境界で検証・変換し、内部では `undefined` として扱う。

**受信側**の変換は、Zod スキーマ上で `null` リテラルを書かずに表現できる。

```ts
// 外部の string | null を内部の string | undefined へ変換する定石
const MiddleName = z.string().nullable().transform((v) => v ?? undefined);
```

**送信側**（外部APIへ `null` を送る、DBカラムへ `NULL` を書くなど）では、外部契約上 `null` の使用が避けられない。このため、`adapters/` に限り `null` の型・値の使用を許可する（→ [6.1](#61-禁止される型迂回記述型破壊記述)）。この `null` は外部システムとの境界表現に限り、port の型や `adapters/` の外へ漏らしてはならない。`null` を避けるために外部契約を `undefined` で代用してはならない（JSONでは「キーの欠落」と「`null`」は別の意味を持つ）。

### 6.6 ID、金額、日時などはプリミティブのまま広げない

重要な値は、単なる `string` や `number` として広範囲に流さない。

```ts
export type CustomerId = Brand<string, "CustomerId">;
export type InvoiceId = Brand<string, "InvoiceId">;
```

ブランド型などの補助が必要な場合は、`src/unsafe` に閉じ込めた汎用ユーティリティを使う。各モジュールで独自に `as` を使ってブランド化してはならない。複数モジュールで共有する ID の配置は [4.1](#41-モジュール間の依存方向) に従う。

ブランド付け（名目的型付け）と検証（実行時の妥当性確認）は別の関心として分離する。ブランド付けはコンパイル時の関心であり、`Brand<T, B>`（`T & { readonly __brand: B }` 相当）の交差型で表現するのが最も単純かつ実行時コストがゼロになる。この `Brand<T, B>` 型と、生値をブランド型へ載せる唯一の `as` を含む変換ヘルパは `src/unsafe` に置く。

Zod の `.brand()` は使わない。`.brand()` は構築のたびに検証を走らせ、hot path（大量のDB行のマッピングなど）で無駄な実行時コストを生み、ドメイン型の同一性を Zod のブランド表現に結合させるためである。検証が必要な生値は境界で Zod により検証し、その `transform` の中で `src/unsafe` のブランド変換ヘルパを呼ぶ。

```ts
// src/unsafe: `as` はこのヘルパにのみ閉じ込める
export function brand<T, B extends string>(value: T): Brand<T, B> { /* ... */ }

// 境界(app/adapters): 検証してからブランド化する
const CustomerId = z.uuid().transform((s) => brand<string, "CustomerId">(s));
```

`brand` ヘルパ自体は検証を伴わないため、任意の場所から呼べると 6.4 の検証を迂回する抜け道になる。`brand` の呼び出しは、**境界（`app/`・`adapters/`・`config/`）での検証済み値の変換**と、**`model/`（共有カーネル `shared/model` を含む）のスマートコンストラクタ内**（→ [6.7.2](#672-model-に置くのは複数境界で共有するドメイン検証に限る)）に限る。`unsafe` への依存自体はどの領域からも許可される（→ [4](#4-依存方向のルール)）ため、この呼び出し制約は依存規則では強制されない。レビューで担保する。

### 6.7 スキーマの配置

Zod スキーマは専用ディレクトリ（`schemas/` など）にまとめない。技術別の一括配置は 5.1 の思想に反し、変更範囲を誤認させる。代わりに、**各スキーマが定義・検証する型と同じ場所に同居させる**。所在は次の基準で決める。

| スキーマが定義・検証する対象 | 置き場所 |
|---|---|
| ドメイン概念・値オブジェクト・境界を越えるドメイン列挙で、**2つ以上の境界から共有される**もの | その `modules/*/model/`（型と同居） |
| 特定ユースケースの入力・出力契約（`CreateInvoiceInput` など） | その `modules/*/operations/`（操作と同居） |
| 特定外部システムのワイヤ形状（外部APIレスポンス、DB行、キューのペイロード） | その `modules/*/adapters/` |
| トランスポート固有のフレーミング（無ければ operations のスキーマを再利用） | その `app/` の該当境界 |
| 環境変数・設定 | `config/` |
| 業務知識を含まない汎用フィールド（email形式、非空文字列など） | `shared/validation/` |

#### 6.7.1 ユースケース入力スキーマはモジュールが所有する

ユースケースの入力スキーマ（生データ → `CreateInvoiceInput` の変換）は、それを消費する `operations/` の側で定義し、モジュールの公開入口（`index.ts`）から export する。`app/` は import して `.safeParse()` を呼ぶだけとし、スキーマそのものを `app/` 側に持たない。

これにより、境界型（6.3）とスキーマを同一モジュールに置いて `z.infer` で単一の真実にでき、`app/` を薄く保て（3.8）、同じユースケースを別トランスポート（HTTPとCLI）から呼ぶときに検証を重複させずに済む。

```ts
// modules/billing/operations/createInvoice.ts（大きくなれば createInvoice.schema.ts に分離）
export const CreateInvoiceInputSchema = z.object({ /* ... */ });
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

// app/http 側: 検証は境界で行う（safeParse が標準、→ 6.4）
const parsed = CreateInvoiceInputSchema.safeParse(rawBody);
if (!parsed.success) {
  return toBadRequestResponse(parsed.error);
}
return createInvoice(parsed.data, deps);
```

#### 6.7.2 `model/` に置くのは「複数境界で共有するドメイン検証」に限る

スキーマを `model/` に置く正当な理由は、**同じドメインの形状・不変条件を2つ以上の境界で検証する必要があり、その全境界が合法に到達できる共通点が `model/` だけ**である、という一点に尽きる（依存規則上、`adapters -> operations` や `app -> adapters` は不可のため、境界をまたぐ共有スキーマは `model/` か `shared/` にしか置けない）。

`model/` に置く例:

- inbound API（`app/` で parse）でも DB復元（`adapters/` で parse）でも同じ妥当性を要求する値オブジェクト（`Money`、`EmailAddress`、`IsoCurrencyCode` など）
- DBカラム・APIペイロード・キューメッセージのどこから来ても同じ定義で検証したい、境界を越えるドメイン列挙（`SubscriptionStatus = "active" | "canceled" | "past_due"` など）
- 値オブジェクトのスマートコンストラクタ（`createMoney(n): Result<Money, ...>` 等の不変条件付き構築）。これはドメインロジックそのもので純粋であり、Zod で書いても手書きの純粋関数で書いてもよい

否定側のルール（重要）:

- **単一の境界でしか使わないスキーマを `model/` に置いてはならない。** ユースケース入力は `operations/`、外部システム固有の形状は `adapters/` に留める。
- 境界をまたぐ共有が発生しないモジュールでは、`model/` にスキーマが1つも無くてよい。`model/` はスキーマの既定の置き場ではなく、あくまで「2境界以上で共有するドメイン検証の DRY 解」である。

### 6.8 `interface` と `type` の使い分け

**原則として `type` を使う。`interface` は `ports/` の能力契約に限って使う。**

| 対象 | キーワード |
|---|---|
| `ports/` の能力契約（`adapters/` が実装するもの） | `interface` |
| タグ付きUnion / ブランド型 / 交差型 / mapped・conditional・template literal 型 | `type`（他に選択肢なし） |
| `z.infer` の出力 | `type`（他に選択肢なし） |
| 入出力DTO・値オブジェクト・その他の形状 | `type` |

#### 6.8.1 `interface` は `ports/` に限る

`ports/` は本アーキテクチャで唯一「`adapters/` が `implements` する」関係を持つ領域である。`interface` を使うことで「これは実装される契約である」という意図が型レベルで表現でき、`main.ts` が配線する対象であることも明確になる。契約の合成には `extends` を使う。

```ts
export interface InvoiceRepository {
  findById: (id: InvoiceId) => Promise<Invoice | undefined>;
  save: (invoice: Invoice) => Promise<void>;
}
```

関数メンバーはメソッド構文ではなくプロパティ構文で宣言する（→ [6.8.4](#684-関数メンバーはプロパティ構文で書く)）。

#### 6.8.2 それ以外はすべて `type`

- タグ付きUnion（8.1 の結果型、`SubscriptionStatus` など）、ブランド型（6.6）、`z.infer` の出力（6.7.1）は `interface` では表現できないため、必然的に `type` を使う。
- 入出力DTO、値オブジェクトの形状なども、上記と表記を揃えるために `type` に統一する。

「実装される契約か否か」というこの軸は、TS標準の「オブジェクトかUnionか」という軸よりも、本アーキテクチャの `ports`/`adapters` 境界に対して意味が明確である。

#### 6.8.3 宣言マージに依存しない

`interface` は宣言マージ（declaration merging）を許すため、同名の `interface` が別ファイルで暗黙に合体しうる。これは「巨大な文脈なしに局所判断できる」原則（[2](#2-基本原則) の原則8）と機械的検証（原則6）に反する遠隔作用である。

- どこでも `interface` の宣言マージに依存してはならない。同名の再宣言は機能ではなくエラーの兆候として扱う。
- `interface` の使用を `ports/` に閉じることで、このマージ面を最小化し、元々厳しくレビューする領域に限定する。
- 宣言マージのもうひとつの侵入口である `declare module` / `declare global`（外部パッケージの型やグローバル型をファイル横断で書き換えられる）は、`namespace` とあわせて、`unsafe/` を含む**全域**で禁止する（→ [6.1](#61-禁止される型迂回記述型破壊記述)）。`unsafe/` はどの領域からも依存されうるため、ここに宣言マージを許すと影響が全域に及ぶ。

#### 6.8.4 関数メンバーはプロパティ構文で書く

`interface`・型リテラルの関数メンバーは、メソッド構文ではなくプロパティ構文で宣言する。

```ts
// 避ける: メソッド構文（パラメータが双変検査される）
export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>;
}

// 望ましい: プロパティ構文（strictFunctionTypes の反変検査が効く）
export interface InvoiceRepository {
  save: (invoice: Invoice) => Promise<void>;
}
```

理由: TypeScript の `strictFunctionTypes` はメソッド構文のシグネチャに適用されず、パラメータが**双変（bivariant）** のまま検査される。このため、メソッド構文で書いた port の契約は「契約より狭い入力型で実装した adapter」（例: `Wide` を受ける契約を `Narrow` しか受けない実装で満たす）をコンパイルエラーにせず、「失敗の分類は port の定義が決め、`adapters/` はそれに従う」（→ [8.4](#84-ports-の失敗契約)）という前提を型レベルで裏切る。プロパティ構文は反変検査を受け、この不健全性を塞ぐ。

この禁止は `ports/` を含む全域に適用し、ESLint で機械的に強制する（→ [10](#10-機械的な強制)）。クラスの**実装を持つメソッド宣言**はこの対象外である。実装はそれが `implements` する契約のプロパティ構文の型に対して検査されるため、双変の穴は生じない。

ただし、クラスの **abstract メソッドは対象に含める**。abstract メソッドは実装を持たない宣言であり、interface のメソッド構文と同じ双変の穴を持つ（契約より狭い入力型のサブクラス実装が override 検査を素通りする）。abstract メンバーもプロパティ構文（`abstract save: (invoice: Invoice) => Promise<void>;`）で宣言する。これも ESLint で機械的に強制する（アクセサの abstract 宣言はプロパティとして型検査されるため対象外）。

### 6.9 列挙は `enum` ではなく Union で表す

固定された値の集合は、TypeScript の `enum`（`const enum` を含む）ではなく、文字列リテラルUnionで表す。理由:

- **`enum` はランタイムコードを生成する。** 「型はコンパイル時の制約」という本文の姿勢（[6.4](#64-外部入力は実行時にも検証する)）と噛み合わず、`--erasableSyntaxOnly`（TS 5.8 以降）の下では使用できない。「型情報を消すだけで実行可能な JavaScript になる」という性質が保てなくなり、その性質を前提とするツール・実行環境で扱えなくなる。
- **数値 `enum` は型安全でない。** 宣言外の数値が代入位置に紛れ込みうるなど、原則5（型安全性）に反する。
- **Zod（準標準、[1.2](#12-zod-は準標準ライブラリとして扱う)）との相性。** `z.enum([...])` から `z.infer` で、スキーマ・型・ランタイム値を単一の宣言から得られる（[6.7](#67-スキーマの配置) の「単一の真実」と一致）。
- **局所性・可読性。** Union は値が tooltip やエラーにそのまま現れる。原則8・[16.3](#163-暗黙の規約を減らす) に沿う。

網羅性は `never` を使った exhaustive switch で Union でも担保できるため、`enum` の利点は失われない。

推奨する書き方:

```ts
// 境界をまたぐ列挙: Zod を単一の真実にする（配置は 6.7.2 に従う）
export const SubscriptionStatus = z.enum(["active", "canceled", "past_due"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;
// ランタイムで全値が必要なら SubscriptionStatus.options

// 内部限定でランタイム値が不要な列挙: 単純な文字列リテラルUnion
type Direction = "up" | "down";

// ランタイムの値配列が欲しいが Zod を使わない場合: as const 配列を真実にする
const SUBSCRIPTION_STATUSES = ["active", "canceled", "past_due"] as const;
type SubscriptionStatusInternal = (typeof SUBSCRIPTION_STATUSES)[number];
```

この禁止はESLintで機械的に強制する（→ [10](#10-機械的な強制)）。

### 6.10 readonly なオブジェクトを可変な型で受けない

TypeScript の構造的部分型では、プロパティの `readonly` 修飾子は代入可能性の判定に**影響しない**（microsoft/TypeScript#13347）。このため、`readonly` なプロパティを持つ値を、その `readonly` が外れた型の変数・引数・戻り値へエラーなく渡せてしまい、新しい別名（エイリアス）を通じて元の値を書き換えられる。

```ts
const frozen: { readonly count: number } = { count: 0 };

// TypeScript はエラーにしないが、禁止。frozen が可変な別名を得る
const leaked: { count: number } = frozen;
leaked.count = 1; // frozen.count も 1 になる
```

原則として、**値の readonly 性は下流でも保存する**。

- 受け側の型も `readonly` にする（`Readonly<T>`、プロパティの `readonly` 修飾）。
- 本当に可変な値が必要な場合は、代入ではなく明示的なコピーを作って渡す。スプレッドは浅いコピーである点に注意し、ネストした readonly を可変にしたい場合は必要な深さまで明示的に作り直す。

```ts
// 望ましい: readonly を保存する
const kept: { readonly count: number } = frozen;

// 可変な値が必要なら、新しい値を作る（スプレッドは readonly を外した新しい型を生む）
const copy: { count: number } = { ...frozen };
```

この制約は TypeScript のコンパイラでも標準の ESLint / typescript-eslint ルールでも検査できないため、自作ルール `local/no-readonly-to-mutable` で機械的に強制する（→ [10.2](#102-自作ルールeslint-rules)）。自作ルールには検出できない経路（既知の限界は実装 `eslint-rules/no-readonly-to-mutable.ts` のコメントに列挙する）があるため、限界に該当する箇所はレビューで readonly 性の保存を確認する。

## 7. 副作用の扱い

### 7.1 副作用は明示的に注入する

時刻、乱数、DB、外部API、メール送信、ログ出力などは、関数内で暗黙に取得しない。

避ける例:

```ts
export function issueInvoice(customer: Customer): Invoice {
  return {
    customerId: customer.id,
    issuedAt: new Date(),
  };
}
```

望ましい例:

```ts
export function issueInvoice(input: {
  customer: Customer;
  issuedAt: Date;
}): Invoice {
  return {
    customerId: input.customer.id,
    issuedAt: input.issuedAt,
  };
}
```

純粋領域での時刻・乱数・I/O のグローバル直接参照（`Date.now()`・`Math.random()` など）は、ESLint でも機械的に検出する（→ [10](#10-機械的な強制)）。

### 7.2 外部操作は `ports/` 経由で扱う

`operations/` で外部操作が必要な場合、具体実装ではなくインターフェースに依存する。具象の生成・注入は `main.ts` が行う（→ [3.11](#311-maintsコンポジションルート)）。

```ts
export async function createInvoice(
  input: CreateInvoiceInput,
  deps: {
    invoiceRepository: InvoiceRepository;
    clock: Clock;
  },
): Promise<CreateInvoiceResult> {
  const issuedAt = deps.clock.now();
  // ...
}
```

これにより、テスト時に外部サービスやDBを使わずに振る舞いを検証できる。

### 7.3 トランザクション境界を明示する

複数の Repository やport をまたいで原子的に更新する必要がある場合、トランザクション境界を暗黙にしてはならない。

方針として、次のいずれかを採用し、プロジェクト内で統一する。

1. **Unit of Work をportとして定義する。** `operations/` は「この一連の操作を1トランザクションで実行する」ことをport経由で表明し、境界の張り方は `adapters/` が実装する。
2. **トランザクション実行子を `deps` として注入する。** `operations/` は `deps.transaction(async (tx) => { ... })` のように、境界の開始・確定・巻き戻しを抽象経由で制御する。

いずれの場合も、`operations/` はトランザクションの**境界**を宣言するのみで、具体的なDBトランザクションAPIには依存しない。どの操作が同一トランザクションを必要とするかは、`operations/` のテストで検証する（→ [9.2](#92-operations-は依存を差し替えてテストする)）。

## 8. エラー設計

### 8.1 予期される失敗はタグ付きUnionの結果型で返す

業務上あり得る失敗は、例外ではなく明示的な結果型で返す。**本プロジェクトの標準は、`reason` を具体的な文字列リテラルUnionで表現するインラインのタグ付きUnion**とする。これにより `switch` による網羅性検査が効く。

```ts
export type RegisterUserResult =
  | { ok: true; userId: UserId }
  | { ok: false; reason: "EMAIL_ALREADY_USED" | "INVALID_EMAIL" };
```

汎用的な `Result<T, E>` 型（`shared` に定義）は、失敗理由を型パラメータで受け取れるようにしたうえで、横断的な補助（`map` / `andThen` など）が必要な場合にのみ使う。個々のユースケースの戻り値は、上記のように失敗理由を具体化したインラインUnionを優先する。

### 8.2 例外は予期しない異常に限定する

プログラミングミス、外部ライブラリの想定外エラー、復旧不能なシステム異常などは例外として扱ってよい。

ただし、アプリケーション境界（`app/`）で捕捉し、ログ、メトリクス、レスポンス変換を行う。

### 8.3 エラー文字列を直接比較しない

エラー判定には、列挙可能なコード、タグ付きUnion、専用型を使う。

避ける例:

```ts
if (error.message === "not found") {
  // ...
}
```

望ましい例:

```ts
if (result.reason === "CUSTOMER_NOT_FOUND") {
  // ...
}
```

### 8.4 `ports/` の失敗契約

port が表す外部操作にも、業務上起こり得る失敗と、予期しない異常の区別を適用する。

- **業務上起こり得る失敗**（決済拒否、在庫競合、対象の不存在、楽観ロック失敗など）は、port の**戻り値型**（タグ付きUnion、→ [8.1](#81-予期される失敗はタグ付きunionの結果型で返す)）で表現する。`adapters/` は、外部SDKが投げる例外やエラーコードをこの戻り値へ変換する責務を持つ。
- **予期しない異常**（ネットワーク断、外部システムの想定外エラー、設定ミスなど）のみ throw してよい。throw された例外は `operations/` で握りつぶさず、`app/` の境界まで伝播させて [8.2](#82-例外は予期しない異常に限定する) に従って処理する。

同じ失敗を、ある adapter では戻り値で、別の adapter では例外で表す、といった揺れを作ってはならない。失敗の分類は port の定義（`ports/`）が決め、`adapters/` はそれに従う。

## 9. テスト戦略

### 9.1 中心ルールは高速な単体テストで守る

`model/` の重要な計算、判定、状態遷移、不変条件は、外部I/Oなしの高速な単体テストで検証する。

### 9.2 `operations/` は依存を差し替えてテストする

`operations/` は、DBや外部APIの実物ではなく、`ports/` のテスト用実装を注入して検証する。

検証対象:

- 正常系
- 業務上の失敗
- 権限不足（認可）
- 入力不正
- 外部依存の失敗
- 冪等性が必要な操作の再実行
- トランザクション境界（失敗時にまとめて巻き戻ること）

### 9.3 `adapters/` は契約を検証する

`adapters/` は、`ports/` の契約を満たしていることをテストする。

DB、外部API、メッセージキューなどを使うテストは、単体テストとは分離し、実行コストと失敗要因を明確にする。

### 9.4 `type-guards/` は網羅的にテストする

`type-guards/` に置く関数は、型システムを明示的に絞り込む例外であるため、通常の判定関数より厳格にテストする。

検証対象:

- 肯定されるべき値
- 否定されるべき値
- 境界値
- 構造が似ているが異なる値
- 将来フィールドが増えた場合に誤判定しないこと

### 9.5 `unsafe/` は型テストを持つ

`src/unsafe` のユーティリティは、通常の実行時テストに加えて、可能な限り型テストで検証する。

型テストは、対象コードと同じディレクトリに `<対象ファイル名>.test-d.ts` として置く（→ [16.2](#162-関連するテストを近くに置く)）。型テストは `npm run test` で実行時テストと一括実行される（→ [11.7](#117-変更後は-npm-run-check-を通す)）。

検証対象:

- 期待する型推論が成立すること
- 誤った型が拒否されること
- 公開APIが過剰に広い型を返さないこと
- `unknown` を任意型へ変換する抜け道になっていないこと

### 9.6 回帰テストをAI変更の安全網にする

AIによる変更は局所的に見えても、意図しない振る舞い変更を含むことがある。

重要な仕様、過去の不具合、境界条件は、回帰テストとして残す。

### 9.7 テストコードにも同一の型規律を適用する

テストファイルは、対象コードと同じディレクトリに `<対象ファイル名>.test.ts` として置く（→ [16.2](#162-関連するテストを近くに置く)）。

テストファイルにも [6.1](#61-禁止される型迂回記述型破壊記述) の禁止と10節の Lint を通常領域と同一に適用し、テスト向けの緩和は設けない。テストは仕様の記述であり、型の嘘が混ざると回帰テスト（→ [9.6](#96-回帰テストをai変更の安全網にする)）の信頼性そのものが下がるためである。

- 非nullアサーション `!` の代わりに、`undefined` を明示的に分岐して失敗させる（テストフレームワークのアサーションで絞り込む）。
- `as` によるモックやテストデータの捏造の代わりに、テストデータのファクトリ関数と `satisfies` を使う。
- `ports/` のテスト用実装は、`interface` を完全に実装した具象として書く（→ [9.2](#92-operations-は依存を差し替えてテストする)）。

## 10. 機械的な強制

本文書が定める禁止事項は、ESLint と dependency-cruiser で機械的に強制する。**具体的なルール定義は、リポジトリの `eslint.config.ts`（および自作ルール `eslint-rules/`）と `.dependency-cruiser.cjs` を唯一の真実とする。** 本文書は「何が禁止されているのか」とその理由（6節ほか）のみを定め、それを機械的にどう実現するか（ルールの選定、既知のすり抜け経路の封鎖、例外領域ごとの緩和の実装）は本文書では扱わない。個々の設定の意図・理由・既知の限界は、設定ファイルとルール実装のコメントに記録する。

- 例外領域（`type-guards/`・`unsafe/`・`adapters/`）で何がどこまで緩和されるかは [6.1](#61-禁止される型迂回記述型破壊記述) に定める。
- テストファイル（`*.test.ts` / `*.test-d.ts`）にも同一の設定を適用し、緩和しない（→ [9.7](#97-テストコードにも同一の型規律を適用する)）。
- ソースファイルの拡張子は `.ts`（必要な場合に限り `.mts` / `.cts`）のみとする。ESLint の検査対象は拡張子（files glob）で選別されるため、標準外の拡張子のファイルは本節のガードレールを一切受けずに素通りしてしまう。これを防ぐため、`.tsx` / `.jsx`（全域）および `src/` 配下の `.js` 系は、内容にかかわらずファイルごと禁止する（ESLint で強制する）。
- 機械的に検出できない残余経路（シャドーイングによるグローバル参照の迂回、自作ルールの既知の限界など）は、レビューで担保する。

### 10.1 ESLint・dependency-cruiser の設定は変更しない

ESLint（`eslint.config.ts`）が定める型安全性ルールや例外ディレクトリの扱い、および dependency-cruiser（`.dependency-cruiser.cjs`、`npm run lint:deps`）が機械的に強制する依存方向・公開入口のルール（→ [4](#4-依存方向のルール)・[5.2](#52-モジュール外から内部実装を参照しない)）は、単なる設定ではなく、本ドキュメントが定める設計そのものを表現したガードレールであるため、変更してはならない。この変更禁止は、自作ルールの実装（`eslint-rules/`、→ [10.2](#102-自作ルールeslint-rules)）にも適用する。

`tsconfig.json` も同様にガードレールの一部である。特に、[1.1](#11-前提環境) が求める型安全性オプション（`strict`・`noUncheckedIndexedAccess`・`exactOptionalPropertyTypes`・`erasableSyntaxOnly`）の無効化・緩和、検査対象（`include`）の縮小、および `jsx` オプションの追加（標準外拡張子ファイルの禁止を迂回する入口になる）を行ってはならない。型エラーはコンパイラ設定ではなくコードを直して解消する（→ [11.2](#112-型エラーを迂回しない)）。

### 10.2 自作ルール（eslint-rules/）

標準の ESLint / typescript-eslint に存在しない検査（例: readonly 性の保存、→ [6.10](#610-readonly-なオブジェクトを可変な型で受けない)）は、リポジトリ直下の `eslint-rules/` に型情報を使う自作ルールとして置き、`eslint.config.ts` から `local/` プレフィックスで登録する。

- `eslint-rules/` は Lint 基盤であり、アプリケーションコードではない。3節の `src/` の語彙には含めず、`src/` の外に置く。ESLint と dependency-cruiser の検査対象からも除外する（[6.1](#61-禁止される型迂回記述型破壊記述) の型規律を適用できない理由は 6.1 の末尾に述べた）。ただし `strict` な型検査（`npm run typecheck`）は通常どおり適用し、実装の正しさはテスト（次項）で担保する。
- 自作ルールは必ずテストを持つ（`@typescript-eslint/rule-tester`、対象ファイルと同じディレクトリの `<対象ファイル名>.test.ts`、→ [16.2](#162-関連するテストを近くに置く)）。検出すべきコードと検出してはならないコードの両方を固定する。型規律の対象外である分、テストがこの領域の主たる品質保証となる。
- 各ルールの検出対象と既知の限界（検出できない経路）は、ルール実装のコメントに列挙する。既知の限界に該当する箇所は、レビューで担保する（→ [6.10](#610-readonly-なオブジェクトを可変な型で受けない)）。
- `eslint.config.ts` が定める禁止事項と例外領域の振る舞い自体も、設定テスト（`eslint-rules/eslint-config.test.ts`）で固定する。設定を変更した場合（[10.1](#101-eslintdependency-cruiser-の設定は変更しない) により原則禁止）はこのテストが落ちる。

## 11. コーディングエージェント向けルール

コーディングエージェントは、以下のルールに従う。

### 11.1 変更前に所属領域を判定する

変更対象が次のどこに属するかを判断してから実装する。

- `model/`: 中心ルール、計算、状態、不変条件
- `operations/`: ユースケース、ワークフロー、依存の調停、認可、トランザクション境界
- `ports/`: 外部能力の抽象
- `adapters/`: 外部技術との接続
- `type-guards/`: どうしても必要な明示的Type Guard
- `unsafe/`: 型システムの限界を補う汎用ユーティリティ
- `app/`: HTTP、CLI、ジョブ、ワーカーなどの入口
- `config/`: 設定・環境変数の読み込みと検証
- `main.ts`: 具象の生成と配線
- `shared/`: 複数領域で使う汎用部品

所属が曖昧な場合、既存の近い実装を探し、同じ配置規則に従う。

### 11.2 型エラーを迂回しない

型エラーを解消するために、[6.1](#61-禁止される型迂回記述型破壊記述) の型迂回記述を導入してはならない。

型エラーが出た場合は、型定義、入力検証、分岐、データ変換、依存境界のいずれかを修正する。

### 11.3 既存の境界を越える変更は最小化する

ひとつの修正で複数モジュールにまたがる変更を行う場合、次を確認する。

- 本当に複数モジュールの変更が必要か
- 公開入口を経由しているか
- 内部実装へ直接依存していないか
- テストが変更範囲を覆っているか
- 型破壊の例外領域を不必要に使っていないか

### 11.4 新しい抽象を安易に作らない

共通化は、少なくとも複数の具体例があり、将来の変更方向が明確な場合に限る。

AIは重複を見つけると早期に抽象化しがちだが、未成熟な抽象は保守性を下げる。

許容される重複:

- まだ共通概念か判断できない類似コード
- 異なる業務文脈に属する偶然の一致
- 将来の変更方向が異なる可能性が高い処理

共通化すべき重複:

- 同じ業務ルールの重複
- 同じ外部契約の重複
- 同じ不具合修正を複数箇所に適用する必要がある重複

### 11.5 大規模変更を避ける

要求された修正に不要なリネーム、フォーマット変更、ディレクトリ移動、抽象化、依存更新を行ってはならない。

特に、AIによる「ついでの改善」は原則禁止する。

### 11.6 テストまたは検証手順を更新する

振る舞いを変更した場合は、対応するテストを追加または更新する。

テスト追加が困難な場合は、理由と手動検証手順を記録する。

### 11.7 変更後は `npm run check` を通す

変更を完了とする前に、必ず `npm run check` を実行し、すべて成功することを確認する。`npm run check` は、型検査（`typecheck`）・ESLint（`lint`）・依存方向の検査（`lint:deps`）・テスト（`test`、型テストを含む）を一括で実行する。

いずれかが失敗した状態の変更を完了として報告してはならない。失敗を解消できない場合は、失敗内容と理由をそのまま報告する。

## 12. `shared/` の扱い

### 12.1 `shared/` に置いてよいもの・置いてはならないもの

`shared/` は便利な置き場ではない。

置いてよいもの:

- 汎用的なエラー型
- 汎用的なResult型
- 日付・文字列などの純粋なユーティリティ
- 横断的なバリデーション補助
- 業務知識を含まない型補助
- 複数モジュールが共有する ID・値オブジェクト（共有カーネル、→ [4.1](#41-モジュール間の依存方向)）
- 共有カーネルの型に対する明示的な Type Guard（`shared/type-guards/`、規律は [3.6](#36-type-guards) と同一）

置いてはならないもの:

- 特定モジュールの業務ルール
- 特定モジュールのDTO
- 特定モジュールのRepository
- 特定ユースケースのためだけの関数

### 12.2 `shared/` の肥大化を防ぐ

`shared/` が肥大化した場合、モジュール境界が曖昧になっている可能性がある。

新しい共通部品を追加する前に、特定モジュールに閉じたままにできないかを検討する。

## 13. 命名規則

### 13.1 名前は責務を表す

ファイル名、関数名、型名は、その責務が分かる名前にする。

避ける名前:

```text
manager / helper / common / util / service / processor / handler
```

これらの名前は、責務が曖昧な場合に使われやすい。

ただし、プロジェクト内で明確な意味を定義している役割語は例外とする。本ルールでは `HTTP handler` を「3.8 `app/http/` の入口関数」を指す役割語として用いており、この用法は許容する。責務が曖昧なまま `handler` を汎用の関数名・ファイル名に流用することを禁じる趣旨である。

### 13.2 操作は動詞で始める

ユースケースや操作を表す関数は、動詞で始める。

```text
createInvoice / cancelSubscription / calculateTax / registerUser
```

### 13.3 型名は概念を表す

型名は、構造ではなく意味を表す。

避ける例:

```ts
type Data = { /* ... */ };
type Payload = { /* ... */ };
type Info = { /* ... */ };
```

望ましい例:

```ts
type CreateInvoiceInput = { /* ... */ };
type PaymentAuthorizationResult = { /* ... */ };
type SubscriptionStatus = "active" | "canceled" | "past_due";
```

## 14. 状態管理

### 14.1 状態遷移は明示する

重要な状態は、単なる文字列変更として扱わない。状態遷移には専用の関数を用意し、許可される遷移と禁止される遷移を明示する。

```ts
export function cancelSubscription(
  subscription: Subscription,
): CancelSubscriptionResult {
  if (subscription.status === "canceled") {
    return { ok: false, reason: "ALREADY_CANCELED" };
  }

  return {
    ok: true,
    subscription: {
      ...subscription,
      status: "canceled",
    },
  };
}
```

### 14.2 状態変更の入口を集約する

重要な状態を任意の場所で直接変更してはならない。状態変更は、その状態のルールを知っている関数または操作を通じて行う。

## 15. 外部境界

### 15.1 HTTP境界

HTTP handler は次の責務に限定する。

- リクエストの取り出し
- 入力検証
- 認証・認可情報の取得
- `operations/` の呼び出し
- 結果のHTTPレスポンスへの変換

HTTP handler にビジネスルールを書いてはならない。

HTTP request body、query、params、headers は外部入力である。内部型として扱う前に実行時スキーマで検証する（→ [6.4](#64-外部入力は実行時にも検証する)）。

### 15.2 DB境界

DB schema、ORM model、query builder の都合を中心ルールに漏らしてはならない。

DBから取得したデータは、`adapters/` でモジュール内部の型に変換する。DBが `null` を返す場合は、境界で `undefined` へ変換する（→ [6.5](#65-null-は使わず-undefined-を使う)）。

### 15.3 外部API境界

外部API SDKの型を、`model/` や `operations/` に広げてはならない。

外部APIのレスポンスは `adapters/` で受け取り、実行時スキーマで検証し、内部で扱う型に変換する。

### 15.4 環境変数境界

環境変数は、起動時または設定読み込み時に検証し、型付けされた設定オブジェクトに変換する。この責務は `config/` が持つ（→ [3.10](#310-config)）。

環境変数の不正は、業務上あり得る失敗ではなく、デプロイ・設定の誤りによる予期しない異常（→ [8.2](#82-例外は予期しない異常に限定する)）である。したがって、[6.4](#64-外部入力は実行時にも検証する) の「境界での検証は `.safeParse()` を標準とする」の唯一の例外として、`config/` の起動時検証に限り `.parse()` の throw によるフェイルファスト（起動の中断）を許可する。この例外は、プロセスがリクエストやメッセージを受け付ける前の起動時検証に限る。稼働中に外部入力として受け取る値には適用せず、通常どおり `.safeParse()` を使う。

アプリケーションの任意の場所で `process.env` を直接参照してはならない。

### 15.5 認可

「誰がこの操作を実行してよいか」の判定は、原則として `operations/` で行う。

- `app/`（HTTP handler など）は、認証・認可に必要な情報（実行主体、ロール、スコープなど）を取り出して `operations/` に渡すのみとし、可否判定そのものを持たない。
- 認可に必要なルールが業務ルールと不可分な場合は、判定ロジックを `model/` に置き、`operations/` から呼び出してよい。
- 認可の失敗は、業務上あり得る失敗として結果型で返す（例: `{ ok: false, reason: "FORBIDDEN" }`、→ [8.1](#81-予期される失敗はタグ付きunionの結果型で返す)）。

### 15.6 イベント・メッセージ境界の互換性

イベントペイロード、キューメッセージ、外部公開APIのスキーマは、時間とともに進化する。後方互換を壊す変更を避けるため、次を守る。

- ペイロードにはバージョンを識別できる情報を持たせる（明示的な `version` フィールド、またはトピック/型名による分離）。
- 受信側は未知フィールドに寛容に、送信側は必須フィールドの削除・意味変更に保守的にする。

## 16. AI変更に強いファイル設計

### 16.1 ファイルは大きくしすぎない

ひとつのファイルに複数の責務を詰め込まない。ファイルを読むだけで次が判断できる状態を保つ。

- このファイルが何を担当するか
- どの型を受け取るか
- どの型を返すか
- どの外部依存を使うか
- どのテストを見ればよいか

### 16.2 関連するテストを近くに置く

テストは、対象コードと同じディレクトリに `<対象ファイル名>.test.ts` として置く。型テスト（→ [9.5](#95-unsafe-は型テストを持つ)）は `<対象ファイル名>.test-d.ts` とする。これをプロジェクト標準とし、`tests/` ディレクトリへの集約は行わない（→ [9.7](#97-テストコードにも同一の型規律を適用する)）。

```text
modules/billing/model/calculateInvoiceTotal.ts
modules/billing/model/calculateInvoiceTotal.test.ts
unsafe/brand.ts
unsafe/brand.test-d.ts
```

### 16.3 暗黙の規約を減らす

AIと人間が同じ判断をできるよう、暗黙の規約を減らす。必要な規約は、型・スキーマ・テスト・Lintルール・README・設計判断記録のいずれかで表現する。

## 17. 禁止事項（一覧）

以下を原則として禁止する。各項目の詳細は括弧内のセクションを参照する。

1. `model/` からDB、HTTP、外部SDK、環境変数、時刻、乱数に直接依存すること（[3.2](#32-model)・[4](#4-依存方向のルール)）
2. `operations/` から具体的なDB実装や外部API SDKに直接依存すること（[3.3](#33-operations)・[7.2](#72-外部操作は-ports-経由で扱う)）
3. `main.ts`（および `main.ts` が呼び出す配線コード）以外で `adapters/` の具象を生成・配線すること（[3.11](#311-maintsコンポジションルート)・[4](#4-依存方向のルール)）
4. モジュール外から内部ファイルを直接importすること（[5.2](#52-モジュール外から内部実装を参照しない)）
5. モジュール間に循環依存を作ること（[4.1](#41-モジュール間の依存方向)）
6. 外部入力を実行時検証なしに内部型として扱うこと（[6.4](#64-外部入力は実行時にも検証する)）
7. [6.1](#61-禁止される型迂回記述型破壊記述) の型迂回記述を通常領域で使うこと（`any`、`as`／`<T>value`、非nullアサーション・definite assignment assertion・クラスフィールドの `declare` 修飾子、明示的な型述語・アサーション関数、関数・メソッドのオーバーロード宣言〔`unsafe/` で緩和〕、TSエラー抑制コメント、ESLint無効化コメント、ambient 宣言〔値の宣言のみ `unsafe/` で緩和、`declare module`・`declare global`・`namespace` は全域で禁止〕、宣言ファイル `.d.ts`〔全域で禁止〕、`null` の型・値〔`adapters/` を除く、→ [6.5](#65-null-は使わず-undefined-を使う)〕を含む）
8. 業務ルールをHTTP handler、DB adapter、外部API adapterに書くこと（[3.8](#38-app)・[15](#15-外部境界)）
9. 認可判定を `app/` に持たせること（[15.5](#155-認可)）
10. トランザクション境界を暗黙にすること（[7.3](#73-トランザクション境界を明示する)）
11. 技術分類だけで業務モジュールを分割すること（[5.1](#51-モジュールは業務概念で分ける)）
12. 変更要求に無関係な大規模リファクタリングを同時に行うこと（[11.5](#115-大規模変更を避ける)）
13. `shared/` を雑多な置き場として使うこと（[12](#12-shared-の扱い)）
14. `type-guards/` を外部入力の検証手段として使うこと（[3.6](#36-type-guards)）
15. `unsafe/` を通常実装の型エラー回避に使うこと（[3.7](#37-unsafe)）
16. `unsafe/` から他ディレクトリへ依存すること（[3.7](#37-unsafe)・[4](#4-依存方向のルール)）
17. 境界の検証失敗（外部入力の不正）を `.parse()` の throw で例外経路へ流すこと（`config/` の起動時検証を除く、[6.4](#64-外部入力は実行時にも検証する)・[15.4](#154-環境変数境界)）
18. port の業務上起こり得る失敗を throw で表現すること、または同じ失敗の表現を adapter ごとに揺らすこと（[8.4](#84-ports-の失敗契約)）
19. readonly なオブジェクト値を、その readonly が外れた型の変数・引数・戻り値へ渡すこと（[6.10](#610-readonly-なオブジェクトを可変な型で受けない)）
20. `interface`・型リテラルの関数メンバーをメソッド構文で宣言すること、およびクラスの abstract メソッドを宣言すること（パラメータの双変検査により契約より狭い実装が素通りするため、[6.8.4](#684-関数メンバーはプロパティ構文で書く)。abstract メンバーはプロパティ構文で宣言する）
