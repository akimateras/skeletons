import type { ApiDependencies } from "./apiDependencies.ts";
import type { HttpRequest, HttpResponse } from "./httpMessage.ts";
import { handleCancelOrder, handlePlaceOrder } from "./orderRoutes.ts";
import { handleGetProduct, handleRegisterProduct } from "./productRoutes.ts";

// ルーティング表:
//   POST /products              商品登録
//   GET  /products/:productId   商品取得
//   POST /orders                注文作成(要 x-customer-id ヘッダ)
//   POST /orders/:orderId/cancel 注文キャンセル(要 x-customer-id ヘッダ)
export async function routeRequest(
  request: HttpRequest,
  deps: ApiDependencies,
): Promise<HttpResponse> {
  const segments = request.path.split("/").filter((segment) => segment !== "");
  const [first, second, third, fourth] = segments;

  if (first === "products" && fourth === undefined) {
    if (request.method === "POST" && second === undefined) {
      return handleRegisterProduct(request, deps);
    }
    if (request.method === "GET" && second !== undefined && third === undefined) {
      return handleGetProduct(second, deps);
    }
  }

  if (first === "orders" && fourth === undefined) {
    if (request.method === "POST" && second === undefined) {
      return handlePlaceOrder(request, deps);
    }
    if (request.method === "POST" && second !== undefined && third === "cancel") {
      return handleCancelOrder(second, request, deps);
    }
  }

  return { status: 404, body: { error: "NOT_FOUND" } };
}
