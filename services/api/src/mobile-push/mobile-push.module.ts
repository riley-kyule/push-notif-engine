import { Module } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";

import { DatabaseModule } from "../database/database.module";
import { SitesModule } from "../sites/sites.module";
import { loadRedisConfig } from "../queue/redis.config";
import { MOBILE_CLICKS_REPOSITORY, MOBILE_CREDENTIALS_REPOSITORY, MOBILE_DEVICES_REPOSITORY, MOBILE_PUSH_QUEUE, MobilePushService } from "./mobile-push.service";
import { MobilePushController } from "./mobile-push.controller";
import { PublicMobilePushController } from "./public-mobile-push.controller";
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
    // See browser-push.module.ts: enables BullMQ-level stalled-job recovery. Safe
    // because the processor skips devices already delivered to for this job id
    // (see findAlreadySentDeviceIds).
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      // See browser-push.module.ts: bounds Redis memory growth from job history.
      removeOnComplete: { count: 2_000 },
      removeOnFail: { count: 5_000 },
    },
  });
}

@Module({
  imports: [DatabaseModule, SitesModule],
  controllers: [MobilePushController, PublicMobilePushController],
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
