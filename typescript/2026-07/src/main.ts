// コンポジションルート(ルール 3.11)。ここでのみ adapters の具象を生成し、
// ports の型として app/ へ注入(配線)する。
import { createHttpServer } from "./app/http/createHttpServer.ts";
import { loadAppConfig } from "./config/appConfig.ts";
import { createCryptoProductIdGenerator } from "./modules/catalog/adapters/cryptoProductIdGenerator.ts";
import { createInMemoryProductRepository } from "./modules/catalog/adapters/inMemoryProductRepository.ts";
import { createCryptoOrderIdGenerator } from "./modules/order/adapters/cryptoOrderIdGenerator.ts";
import { createInMemoryOrderRepository } from "./modules/order/adapters/inMemoryOrderRepository.ts";
import { createSystemClock } from "./modules/order/adapters/systemClock.ts";

const config = loadAppConfig();

const server = createHttpServer({
  productRepository: createInMemoryProductRepository(),
  productIdGenerator: createCryptoProductIdGenerator(),
  orderRepository: createInMemoryOrderRepository(),
  orderIdGenerator: createCryptoOrderIdGenerator(),
  clock: createSystemClock(),
});

server.listen(config.port, () => {
  console.log(`EC backend API listening on http://localhost:${String(config.port)}`);
});
