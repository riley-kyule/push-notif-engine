import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";

import { DatabaseModule } from "../database/database.module";
import { SitesModule } from "../sites/sites.module";
import { loadRedisConfig } from "../queue/redis.config";
import { MOBILE_CLICKS_REPOSITORY, MOBILE_CREDENTIALS_REPOSITORY, MOBILE_DEVICES_REPOSITORY, MOBILE_PUSH_QUEUE, MobilePushService } from "./mobile-push.service";
import { MobilePushController } from "./mobile-push.controller";
import { MOBILE_PUSH_QUEUE_NAME } from "./mobile-push.constants";
import { PostgresMobileClicksRepository } from "./postgres-mobile-clicks.repository";
import { PostgresMobileCredentialsRepository } from "./postgres-mobile-credentials.repository";
import { PostgresMobileDevicesRepository } from "./postgres-mobile-devices.repository";

function createMobilePushQueue(): Queue {
  const config = loadRedisConfig();
  return new Queue(MOBILE_PUSH_QUEUE_NAME, {
    connection: new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    }) as never,
  });
}

@Module({
  imports: [DatabaseModule, SitesModule],
  controllers: [MobilePushController],
  providers: [
    MobilePushService,
    {
      provide: MOBILE_CREDENTIALS_REPOSITORY,
      useClass: PostgresMobileCredentialsRepository,
    },
    {
      provide: MOBILE_DEVICES_REPOSITORY,
      useClass: PostgresMobileDevicesRepository,
    },
    {
      provide: MOBILE_CLICKS_REPOSITORY,
      useClass: PostgresMobileClicksRepository,
    },
    {
      provide: MOBILE_PUSH_QUEUE,
      useFactory: () => createMobilePushQueue(),
    },
  ],
  exports: [MobilePushService],
})
export class MobilePushModule {}
