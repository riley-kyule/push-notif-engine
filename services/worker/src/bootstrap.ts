import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg";

import { loadDatabaseConfig, loadRedisConfig } from "./config";
import { BrowserPushProcessor } from "./browser-push.processor";
import { BrowserPushRepository } from "./browser-push.repository";
import { WebPushSender } from "./browser-push.sender";
import type { BrowserPushJobPayload } from "./browser-push.types";
import { clearWorkerHeartbeat, createHeartbeatPayload, writeWorkerHeartbeat } from "./heartbeat";
import { MobilePushProcessor } from "./mobile-push.processor";
import { MobilePushRepository } from "./mobile-push.repository";
import type { MobilePushJobPayload } from "./mobile-push.types";
import { MOBILE_PUSH_QUEUE_NAME } from "./mobile-push.constants";

const BROWSER_PUSH_QUEUE_NAME = "browser-push-dispatch";

function createPool(): Pool {
  const config = loadDatabaseConfig();
  return new Pool({
    connectionString: config.databaseUrl,
    // Bumped from 10: with bounded-concurrency sends (see BROWSER_PUSH_SEND_CONCURRENCY),
    // many per-delivery status updates now run in parallel rather than one at a time.
    // 30 keeps the pool from becoming the new bottleneck without overwhelming a small
    // single-VPS Postgres instance.
    max: 30,
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
  const heartbeatLabel = `worker-${process.pid}`;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const syncHeartbeat = async (): Promise<void> => {
    const startedAt = process.hrtime.bigint();
    await connection.ping();
    const redisLatencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    await writeWorkerHeartbeat(connection, {
      ...createHeartbeatPayload(heartbeatLabel),
      redisLatencyMs: Math.round(redisLatencyMs),
    });
  };

  await syncHeartbeat();
  heartbeatTimer = setInterval(() => {
    void syncHeartbeat();
  }, 30_000);

  const worker = new Worker<BrowserPushJobPayload>(
    BROWSER_PUSH_QUEUE_NAME,
    async (job) => processor.process(job.data, job.id),
    { connection: connection as never },
  );

  const mobileWorker = new Worker<MobilePushJobPayload>(
    MOBILE_PUSH_QUEUE_NAME,
    async (job) => mobileProcessor.process(job.data, job.id),
    { connection: connection as never },
  );

  const close = async (): Promise<void> => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    await clearWorkerHeartbeat(connection).catch(() => undefined);
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
