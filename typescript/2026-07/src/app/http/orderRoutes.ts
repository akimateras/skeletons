import { z } from "zod";
import {
  cancelOrder,
  OrderIdSchema,
  placeOrder,
  PlaceOrderRequestSchema,
  type Order,
} from "../../modules/order/index.ts";
import { CustomerIdSchema, type CustomerId } from "../../shared/model/customerId.ts";
import type { ApiDependencies } from "./apiDependencies.ts";
import type { HttpRequest, HttpResponse } from "./httpMessage.ts";

// 認証情報の取り出しは app/ の責務。可否の判定(認可)は operations が行う(ルール 15.5)。
// 実運用ではセッションやトークンの検証に置き換えるサンプル実装として、
// x-customer-id ヘッダを認証済みの顧客 ID とみなす。
function customerIdFromHeaders(headers: HttpRequest["headers"]): CustomerId | undefined {
  const raw = headers["x-customer-id"];
  if (typeof raw !== "string") {
    return undefined;
  }
  const parsed = CustomerIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export async function handlePlaceOrder(
  request: HttpRequest,
  deps: ApiDependencies,
): Promise<HttpResponse> {
  const customerId = customerIdFromHeaders(request.headers);
  if (customerId === undefined) {
    return { status: 401, body: { error: "UNAUTHENTICATED" } };
  }

  const parsed = PlaceOrderRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "VALIDATION_FAILED", detail: z.prettifyError(parsed.error) },
    };
  }

  const result = await placeOrder(
    { customerId, lines: parsed.data.lines },
    {
      orderRepository: deps.orderRepository,
      orderIdGenerator: deps.orderIdGenerator,
      clock: deps.clock,
      productRepository: deps.productRepository,
    },
  );
  if (result.ok) {
    return { status: 201, body: toOrderResponse(result.order) };
  }
  return { status: 422, body: { error: result.reason, productId: result.productId } };
}

export async function handleCancelOrder(
  rawOrderId: string,
  request: HttpRequest,
  deps: ApiDependencies,
): Promise<HttpResponse> {
  const customerId = customerIdFromHeaders(request.headers);
  if (customerId === undefined) {
    return { status: 401, body: { error: "UNAUTHENTICATED" } };
  }

  const parsedId = OrderIdSchema.safeParse(rawOrderId);
  if (!parsedId.success) {
    return { status: 404, body: { error: "ORDER_NOT_FOUND" } };
  }

  const result = await cancelOrder(
    { orderId: parsedId.data, requestedBy: customerId },
    { orderRepository: deps.orderRepository },
  );
  if (result.ok) {
    return { status: 200, body: toOrderResponse(result.order) };
  }

  // 失敗理由から HTTP ステータスへの変換は exhaustive switch で網羅する(ルール 8.1)
  switch (result.reason) {
    case "ORDER_NOT_FOUND":
      return { status: 404, body: { error: result.reason } };
    case "FORBIDDEN":
      return { status: 403, body: { error: result.reason } };
    case "ALREADY_CANCELED":
    case "ALREADY_SHIPPED":
      return { status: 409, body: { error: result.reason } };
  }
}

// 内部の型をそのまま外部表現にせず、境界で明示的に変換する(ルール 15.1)
function toOrderResponse(order: Order): {
  id: string;
  customerId: string;
  lines: readonly { productId: string; quantity: number; unitPrice: number }[];
  status: string;
  placedAt: string;
  totalAmount: number;
} {
  return {
    id: order.id,
    customerId: order.customerId,
    lines: order.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    status: order.status,
    placedAt: order.placedAt.toISOString(),
    totalAmount: order.totalAmount,
  };
}
