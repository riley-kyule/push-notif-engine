import { Worker } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg";

import { loadBrowserPushConfig, loadDatabaseConfig, loadMobilePushConfig, loadRedisConfig } from "./config";
import { BrowserPushProcessor } from "./browser-push.processor";
import { BrowserPushRepository } from "./browser-push.repository";
import { WebPushSender } from "./browser-push.sender";
import type { BrowserPushJobPayload } from "./browser-push.types";
import { checkBrowserPushEgress } from "./egress-health";
import { clearWorkerHeartbeat, createHeartbeatPayload, heartbeatField, WORKER_HEARTBEAT_HASH, writeWorkerHeartbeat } from "./heartbeat";
import { MobilePushProcessor } from "./mobile-push.processor";
import { MobilePushRepository } from "./mobile-push.repository";
import type { MobilePushJobPayload } from "./mobile-push.types";
import { MOBILE_PUSH_QUEUE_NAME } from "./mobile-push.constants";

const BROWSER_PUSH_QUEUE_NAME = "browser-push-dispatch";

// How stale a heartbeat has to be before we stop treating it as "another worker
// is currently running" — matches the API's platform-health staleness window.
const OTHER_WORKER_FRESH_WINDOW_MS = 2 * 60 * 1000;

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

// This deployment runs exactly one worker process under PM2 — BullMQ itself
// handles concurrent consumers on the same queue safely (jobs are claimed
// atomically, never double-processed), so a second instance wouldn't corrupt
// anything. It would just mean two DB pools, two Redis connections, and two
// heartbeats quietly doing redundant work, which is the kind of thing that's
// easy to miss locally (e.g. `npm run dev` left running in more than one
// terminal tab). This is a heads-up, not an enforced lock.
async function warnIfAnotherWorkerIsRunning(redis: IORedis): Promise<void> {
  const heartbeats = await redis.hgetall(WORKER_HEARTBEAT_HASH).catch(() => ({}) as Record<string, string>);
  const selfField = heartbeatField(process.pid);
  const now = Date.now();

  const otherActivePids: number[] = [];
  for (const [field, raw] of Object.entries(heartbeats)) {
    if (field === selfField) {
      continue;
    }

    try {
      const payload = JSON.parse(raw) as { lastSeenAt?: string };
      const lastSeenMs = payload.lastSeenAt ? Date.parse(payload.lastSeenAt) : NaN;
      if (Number.isFinite(lastSeenMs) && now - lastSeenMs <= OTHER_WORKER_FRESH_WINDOW_MS) {
        const pid = Number.parseInt(field.replace("worker:", ""), 10);
        if (Number.isFinite(pid)) {
          otherActivePids.push(pid);
        }
      }
    } catch {
      // Malformed heartbeat entry — ignore, not worth failing startup over.
    }
  }

  if (otherActivePids.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[worker] ${otherActivePids.length} other worker process(es) already active (pid ${otherActivePids.join(", ")}). ` +
        "Safe to leave running, but if this is a single-VPS deployment you likely only want one — check for leftover processes.",
    );
  }
}

export async function bootstrapBrowserPushWorker(): Promise<{
  close: () => Promise<void>;
}> {
  const pool = createPool();
  const repository = new BrowserPushRepository(pool);
  const processor = new BrowserPushProcessor(repository, new WebPushSender());
  const mobileRepository = new MobilePushRepository(pool);
  const mobileProcessor = new MobilePushProcessor(mobileRepository);
  const browserPushConfig = loadBrowserPushConfig();
  const mobilePushConfig = loadMobilePushConfig();
  const redisConfig = loadRedisConfig();
  const connection = new IORedis(redisConfig.redisUrl, {
    maxRetriesPerRequest: null,
  });
  const heartbeatLabel = `worker-${process.pid}`;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  await warnIfAnotherWorkerIsRunning(connection);

  const syncHeartbeat = async (): Promise<void> => {
    const startedAt = process.hrtime.bigint();
    await connection.ping();
    const redisLatencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const browserPushEgress = await checkBrowserPushEgress();
    await writeWorkerHeartbeat(connection, {
      ...createHeartbeatPayload(heartbeatLabel, browserPushEgress),
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
    {
      connection: connection as never,
      concurrency: browserPushConfig.queueConcurrency,
      // BullMQ's default lockDuration (30s) is auto-renewed every half-interval
      // while a job is processing, which already tolerates a job that takes a
      // long time -- this raises the ceiling further so a brief Redis hiccup
      // delaying one renewal doesn't immediately flag a multi-hundred-thousand-
      // recipient job as stalled and hand it to a second concurrent attempt.
      lockDuration: 10 * 60 * 1000,
    },
  );

  worker.on("failed", (job, error) => {
    const configuredAttempts = job?.opts.attempts ?? 1;
    const exhausted = Boolean(job && job.attemptsMade >= configuredAttempts);
    if (!job?.id || !exhausted) {
      return;
    }

    void repository
      .markPendingDeliveryEventsFailed(job.id, error.message)
      .then(async () => {
        await repository.markInfrastructureIncidentExhausted(job.id!);
        if (job.data.campaignId) {
          await repository.markCampaignFailed(job.data.campaignId);
        }
      })
      .catch((cleanupError: unknown) => {
        // eslint-disable-next-line no-console
        console.error(`[worker] unable to finalize pending deliveries for exhausted job ${job.id}:`, cleanupError);
      });
  });

  const mobileWorker = new Worker<MobilePushJobPayload>(
    MOBILE_PUSH_QUEUE_NAME,
    async (job) => mobileProcessor.process(job.data, job.id),
    { connection: connection as never, concurrency: mobilePushConfig.queueConcurrency, lockDuration: 10 * 60 * 1000 },
  );

  mobileWorker.on("failed", (job) => {
    const configuredAttempts = job?.opts.attempts ?? 1;
    if (job?.id && job.attemptsMade >= configuredAttempts) {
      void mobileRepository.markInfrastructureIncidentsExhausted(job.id).catch((error: unknown) => {
        console.error(`[worker] unable to finalize mobile incident for exhausted job ${job.id}:`, error);
      });
    }
  });

  // Without these, a Redis blip or a processor throwing outside the per-job
  // try/catch (a bug, not a delivery failure) would fail silently — BullMQ
  // emits 'error' on the Worker itself for connection-level problems, which
  // isn't the same as a job's 'failed' event.
  for (const [name, instance] of [["browser-push", worker], ["mobile-push", mobileWorker]] as const) {
    instance.on("error", (error) => {
      // eslint-disable-next-line no-console
      console.error(`[worker] ${name} worker error:`, error);
    });
    instance.on("failed", (job, error) => {
      const configuredAttempts = job?.opts.attempts ?? 1;
      const attempt = job?.attemptsMade ?? configuredAttempts;
      const retryState = attempt < configuredAttempts ? `attempt ${attempt}/${configuredAttempts}; retry scheduled` : `all ${configuredAttempts} attempt(s) exhausted`;
      // eslint-disable-next-line no-console
      console.error(`[worker] ${name} job ${job?.id ?? "unknown"} failed (${retryState}):`, error.message);
    });
  }

  const close = async (): Promise<void> => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    // Run every cleanup step even if an earlier one fails, so a single slow/
    // broken step (e.g. Redis already unreachable) can't leak the rest of the
    // connections — log whatever failed instead of losing it silently.
    const steps: Array<[string, () => Promise<unknown>]> = [
      ["clear heartbeat", () => clearWorkerHeartbeat(connection)],
      ["close browser-push worker", () => worker.close()],
      ["close mobile-push worker", () => mobileWorker.close()],
      ["end database pool", () => pool.end()],
      ["quit redis connection", () => connection.quit()],
    ];

    for (const [label, step] of steps) {
      try {
        await step();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[worker] shutdown step "${label}" failed:`, error);
      }
    }
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
