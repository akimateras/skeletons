import { z } from "zod";

// 環境変数の読み込み・検証は config/ のみが担う(ルール 3.10・15.4)
const AppConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadAppConfig(): AppConfig {
  // 設定の不正はデプロイ・設定の誤りによる予期しない異常であり、
  // 起動時検証に限り .parse() のフェイルファストを許可する(ルール 15.4)。
  return AppConfigSchema.parse({
    port: process.env["PORT"],
  });
}
