import { z } from "zod";
import {
  getProduct,
  registerProduct,
  RegisterProductInputSchema,
  type Product,
} from "../../modules/catalog/index.ts";
import { ProductIdSchema } from "../../shared/model/productId.ts";
import type { ApiDependencies } from "./apiDependencies.ts";
import type { HttpRequest, HttpResponse } from "./httpMessage.ts";

// HTTP handler の責務は、入力検証・operations の呼び出し・レスポンス変換に限る(ルール 15.1)

export async function handleRegisterProduct(
  request: HttpRequest,
  deps: ApiDependencies,
): Promise<HttpResponse> {
  // 外部入力の検証は境界で safeParse する(ルール 6.4)
  const parsed = RegisterProductInputSchema.safeParse(request.body);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "VALIDATION_FAILED", detail: z.prettifyError(parsed.error) },
    };
  }

  const product = await registerProduct(parsed.data, {
    productRepository: deps.productRepository,
    productIdGenerator: deps.productIdGenerator,
  });
  return { status: 201, body: toProductResponse(product) };
}

export async function handleGetProduct(
  rawProductId: string,
  deps: ApiDependencies,
): Promise<HttpResponse> {
  const parsedId = ProductIdSchema.safeParse(rawProductId);
  if (!parsedId.success) {
    // ID の形式が不正なら、その資源は存在し得ない
    return { status: 404, body: { error: "PRODUCT_NOT_FOUND" } };
  }

  const product = await getProduct(parsedId.data, {
    productRepository: deps.productRepository,
  });
  if (product === undefined) {
    return { status: 404, body: { error: "PRODUCT_NOT_FOUND" } };
  }
  return { status: 200, body: toProductResponse(product) };
}

// 内部の型をそのまま外部表現にせず、境界で明示的に変換する(ルール 15.1)
function toProductResponse(product: Product): {
  id: string;
  name: string;
  price: number;
} {
  return { id: product.id, name: product.name, price: product.price };
}
