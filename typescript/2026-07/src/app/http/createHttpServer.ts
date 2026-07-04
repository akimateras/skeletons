import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ApiDependencies } from "./apiDependencies.ts";
import type { HttpResponse } from "./httpMessage.ts";
import { routeRequest } from "./routeRequest.ts";

export function createHttpServer(deps: ApiDependencies): Server {
  return createServer((request, response) => {
    respond(request, response, deps).catch((error: unknown) => {
      // 予期しない異常はアプリケーション境界で捕捉し、レスポンスへ変換する(ルール 8.2)
      console.error(error);
      if (!response.headersSent) {
        writeJson(response, { status: 500, body: { error: "INTERNAL_SERVER_ERROR" } });
      }
    });
  });
}

async function respond(
  request: IncomingMessage,
  response: ServerResponse,
  deps: ApiDependencies,
): Promise<void> {
  const bodyText = await readRequestBody(request);
  const parsedBody = parseRequestBody(bodyText);
  if (!parsedBody.ok) {
    // 不正な JSON は業務上あり得る失敗であり、例外経路へ流さない(ルール 6.4・8.1)
    writeJson(response, { status: 400, body: { error: "INVALID_JSON" } });
    return;
  }

  const httpResponse = await routeRequest(
    {
      method: request.method ?? "GET",
      path: pathWithoutQuery(request.url ?? "/"),
      headers: request.headers,
      body: parsedBody.value,
    },
    deps,
  );
  writeJson(response, httpResponse);
}

function pathWithoutQuery(url: string): string {
  return url.split("?")[0] ?? "/";
}

type ParsedRequestBody = { ok: true; value: unknown } | { ok: false };

function parseRequestBody(text: string): ParsedRequestBody {
  if (text === "") {
    return { ok: true, value: undefined };
  }
  try {
    // JSON.parse は any を返すため、検証前の外部入力として unknown で受ける(ルール 6.4)
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      text += chunk;
    });
    request.on("end", () => {
      resolve(text);
    });
    request.on("error", (error: Error) => {
      reject(error);
    });
  });
}

function writeJson(response: ServerResponse, httpResponse: HttpResponse): void {
  response.writeHead(httpResponse.status, { "content-type": "application/json" });
  response.end(JSON.stringify(httpResponse.body));
}
