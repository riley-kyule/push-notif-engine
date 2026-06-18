import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg";

import { loadDatabaseConfig, loadRedisConfig } from "./config";
import { BrowserPushProcessor } from "./browser-push.processor";
import { BrowserPushRepository } from "./browser-push.repository";
import { WebPushSender } from "./browser-push.sender";
import type { BrowserPushJobPayload } from "./browser-push.types";
import { MobilePushProcessor } from "./mobile-push.processor";
import { MobilePushRepository } from "./mobile-push.repository";
import type { MobilePushJobPayload } from "./mobile-push.types";
import { MOBILE_PUSH_QUEUE_NAME } from "./mobile-push.constants";

const BROWSER_PUSH_QUEUE_NAME = "browser-push-dispatch";

function createPool(): Pool {
  const config = loadDatabaseConfig();
  return new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export async function bootstrapBrowserPushWorker(): Promise<{
  close: () => Promise<void>;
}> {
  const pool = createPool();
  const repository = new BrowserPushRepository(pool);
  const processor = new BrowserPushProcessor(repository, new WebPushSender());
  const mobileRepository = new MobilePushRepository(pool);
  const mobileProcessor = new MobilePushProcessor(mobileRepository);
  const redisConfig = loadRedisConfig();
  const connection = new IORedis(redisConfig.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<BrowserPushJobPayload>(
    BROWSER_PUSH_QUEUE_NAME,
    async (job) => processor.process(job.data),
    { connection: connection as never },
  );

  const mobileWorker = new Worker<MobilePushJobPayload>(
    MOBILE_PUSH_QUEUE_NAME,
    async (job) => mobileProcessor.process(job.data),
    { connection: connection as never },
  );

  const close = async (): Promise<void> => {
    await worker.close();
    await mobileWorker.close();
    await pool.end();
    await connection.quit();
  };

  process.on("SIGTERM", async () => {
    await close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await close();
    process.exit(0);
  });

  return { close };
}
