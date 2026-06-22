import { forwardRef, Module } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";

import { DatabaseModule } from "../database/database.module";
import { SitesModule } from "../sites/sites.module";
import { WorkflowModule } from "../workflows/workflow.module";
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
    // Lets BullMQ itself recover a job whose worker process died mid-run (stalled
    // job detection) instead of relying solely on the in-processor per-subscriber
    // retry loop. Safe to retry the whole job: the processor skips subscribers it
    // already delivered to for this job id (see findAlreadySentSubscriberIds).
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
    },
  });
}

@Module({
  imports: [SitesModule, DatabaseModule, forwardRef(() => WorkflowModule)],
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
