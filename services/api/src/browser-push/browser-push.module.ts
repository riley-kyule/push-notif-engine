import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";

import { DatabaseModule } from "../database/database.module";
import { SitesModule } from "../sites/sites.module";
import { loadRedisConfig } from "../queue/redis.config";
import { BrowserPushRepository } from "./browser-push.repository";
import { BROWSER_PUSH_QUEUE, BrowserPushService } from "./browser-push.service";
import { BrowserPushController } from "./browser-push.controller";
import { BrowserPushDeliveryController } from "./browser-push-delivery.controller";
import { BROWSER_PUSH_QUEUE_NAME } from "./browser-push.constants";

function createBrowserPushQueue(): Queue {
  const config = loadRedisConfig();
  return new Queue(BROWSER_PUSH_QUEUE_NAME, {
    connection: new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    }) as never,
  });
}

@Module({
  imports: [SitesModule, DatabaseModule],
  controllers: [BrowserPushController, BrowserPushDeliveryController],
  providers: [
    BrowserPushService,
    BrowserPushRepository,
    {
      provide: BROWSER_PUSH_QUEUE,
      useFactory: () => createBrowserPushQueue(),
    },
  ],
  exports: [BrowserPushService],
})
export class BrowserPushModule {}
