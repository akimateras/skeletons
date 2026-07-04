/**
 * 依存方向の検査（アーキテクチャルール 4節の依存表を機械的に強制する）。
 *
 * `allowed` は許可リスト方式: ここに列挙されていない依存はすべて違反（not-in-allowed）になる。
 * from.path の正規表現キャプチャ ( $1 ) を to.path で参照し、
 * 「同一モジュール内のみ」の制約を表現している。
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "循環依存の禁止(ルール 4.1: モジュール群は DAG でなければならない)",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment:
        "孤児ファイルの禁止。何も import せず誰からも import されないファイルは依存を生まないため、" +
        "allowed 方式では検出できない。ガイドライン外のディレクトリに置かれた死蔵コードもここで検出する。" +
        "宣言ファイル(.d.ts)も除外しない(本プロジェクトに宣言ファイルは存在しないため: ルール 6.1)。",
      severity: "error",
      from: { orphan: true },
      to: {},
    },
    {
      name: "no-test-imports-from-production",
      comment:
        "本体コードからテストファイル(*.test.ts / *.test-d.ts)への依存の禁止(ルール 4.2・16.2)。" +
        "テストは対象コードと同居するため指定子ひとつで届いてしまい、allowed の同一領域ルール" +
        "(model→model 等)に一致して素通りする。これを許すと本体コードがテストランナー(vitest)へ" +
        "推移的に依存でき、「テストランナーへ依存してよいのはテストファイルのみ」(ルール 4.2)が破れる。",
      severity: "error",
      from: { pathNot: "\\.test(-d)?\\.(ts|mts|cts)$" },
      to: { path: "\\.test(-d)?\\.(ts|mts|cts)$" },
    },
    {
      name: "no-declaration-files",
      comment:
        "宣言ファイル(.d.ts)への依存の禁止(ルール 6.1)。宣言ファイル内の宣言はすべて暗黙に " +
        "ambient となり、実行時の裏付けなしに型を捏造できる。import 指定子が実装 .js を指しても " +
        ".d.ts に解決される経路があるため、依存先としても禁止する(ファイル自体の禁止は ESLint が担い、" +
        "import されない宣言ファイルは no-orphans が検出する)。",
      severity: "error",
      from: {},
      to: { path: "\\.d\\.ts$" },
    },
  ],

  allowedSeverity: "error",
  allowed: [
    // ---- main.ts(コンポジションルート) ----
    // config・app・shared・unsafe、モジュールの公開入口、および配線のための adapters 直接参照(唯一の例外)
    {
      from: { path: "^src/main\\.ts$" },
      to: {
        path: "^src/(config|app|shared|unsafe)/|^src/modules/[^/]+/(index\\.ts$|adapters/)",
      },
    },

    // ---- app ----
    // モジュールへは公開入口(index.ts)経由のみ。加えて shared・config・unsafe・app 内部
    {
      from: { path: "^src/app/" },
      to: { path: "^src/(app|shared|config|unsafe)/|^src/modules/[^/]+/index\\.ts$" },
    },

    // ---- modules/*/index.ts(公開入口) ----
    // 同一モジュールの内部を再エクスポートする(adapters は公開しない)
    {
      from: { path: "^src/modules/([^/]+)/index\\.ts$" },
      to: { path: "^src/modules/$1/(model|operations|ports|type-guards)/" },
    },

    // ---- operations ----
    // 同一モジュールの model・ports・type-guards・operations、shared・unsafe、他モジュールの公開入口
    // (モジュール内部から他モジュールへ依存してよいのは operations のみ: ルール 4.1)
    // 公開入口は「他モジュール」のもののみ。自モジュールの index.ts 経由の参照は、
    // 同一モジュール内の直接参照(ルール 5.2)から外れるため pathNot で除外する。
    {
      from: { path: "^src/modules/([^/]+)/operations/" },
      to: {
        path: "^src/modules/$1/(model|ports|type-guards|operations)/|^src/(shared|unsafe)/|^src/modules/[^/]+/index\\.ts$",
        pathNot: ["^src/modules/$1/index\\.ts$"],
      },
    },

    // ---- adapters ----
    // 同一モジュールの ports・model・type-guards・adapters、shared・unsafe
    {
      from: { path: "^src/modules/([^/]+)/adapters/" },
      to: {
        path: "^src/modules/$1/(ports|model|type-guards|adapters)/|^src/(shared|unsafe)/",
      },
    },

    // ---- ports ----
    // 同一モジュールの model・ports、shared・unsafe
    {
      from: { path: "^src/modules/([^/]+)/ports/" },
      to: { path: "^src/modules/$1/(model|ports)/|^src/(shared|unsafe)/" },
    },

    // ---- type-guards ----
    // 同一モジュールの model・type-guards、shared・unsafe
    {
      from: { path: "^src/modules/([^/]+)/type-guards/" },
      to: { path: "^src/modules/$1/(model|type-guards)/|^src/(shared|unsafe)/" },
    },

    // ---- model ----
    // 同一モジュールの type-guards・model、shared、unsafe
    {
      from: { path: "^src/modules/([^/]+)/model/" },
      to: { path: "^src/modules/$1/(type-guards|model)/|^src/(shared|unsafe)/" },
    },

    // ---- shared/type-guards ----
    // 共有カーネル(shared/model)専用の Type Guard 領域(ルール 3.6)。
    // shared/model と unsafe(および shared/type-guards 内部)のみ参照できる。
    {
      from: { path: "^src/shared/type-guards/" },
      to: { path: "^src/shared/(model|type-guards)/|^src/unsafe/" },
    },

    // ---- shared(type-guards を除く) ----
    // type-guards には上の専用ルールのみを適用するため from から除外する。
    {
      from: { path: "^src/shared/", pathNot: ["^src/shared/type-guards/"] },
      to: { path: "^src/(shared|unsafe)/" },
    },

    // ---- config ----
    { from: { path: "^src/config/" }, to: { path: "^src/(config|shared|unsafe)/" } },

    // ---- unsafe ----
    // 他ディレクトリへの依存は一切禁止(unsafe 内部のみ)。
    // 逆方向(他領域 -> unsafe)はどの領域からも許可される(ルール 3.7・4)。
    { from: { path: "^src/unsafe/" }, to: { path: "^src/unsafe/" } },

    // ---- 外部パッケージ ----
    // 純粋領域(model・operations・ports・type-guards・shared)が依存してよい外部は Zod のみ(ルール 1.2)
    {
      from: {
        path: "^src/(shared|modules/[^/]+/(model|operations|ports|type-guards))/",
      },
      to: { path: "^node_modules/zod/" },
    },
    // 境界領域(app・config・adapters・main)は外部パッケージ・Node 組み込みに依存してよい
    {
      from: { path: "^src/(app|config)/|^src/main\\.ts$|^src/modules/[^/]+/adapters/" },
      to: { path: "^node_modules/" },
    },
    {
      from: { path: "^src/(app|config)/|^src/main\\.ts$|^src/modules/[^/]+/adapters/" },
      to: { dependencyTypes: ["core"] },
    },
    // テストファイル(実行時テスト .test.ts / 型テスト .test-d.ts)はテストランナーに
    // 依存してよい(配置は対象と同居: ルール 9.7)。
    // from を既知領域配下に限定する。任意の場所のテストファイルに許可すると、
    // ガイドライン外のディレクトリに「vitest だけを import するファイル」を素通りさせてしまう。
    {
      from: {
        path: "^src/(app|config|shared|unsafe)/.*\\.test(-d)?\\.ts$|^src/modules/[^/]+/(model|operations|ports|adapters|type-guards)/.*\\.test(-d)?\\.ts$|^src/modules/[^/]+/index\\.test(-d)?\\.ts$|^src/main\\.test(-d)?\\.ts$",
      },
      to: { path: "^node_modules/(vitest|@vitest)/" },
    },

    // ---- 入口のテスト ----
    // 公開入口(index.ts)のテストは、公開APIを通した検証なので index.ts のみを参照する。
    // テストデータの構築に shared・unsafe は使ってよい。
    {
      from: { path: "^src/modules/([^/]+)/index\\.test(-d)?\\.ts$" },
      to: { path: "^src/modules/$1/index\\.ts$|^src/(shared|unsafe)/" },
    },
    // コンポジションルート(main.ts)のテストも同様に許可する。
    {
      from: { path: "^src/main\\.test(-d)?\\.ts$" },
      to: { path: "^src/main\\.ts$|^src/(shared|unsafe)/" },
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    // 型のみの import も依存として数える(実行時に消えても設計上の依存であるため)
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
  },
};
