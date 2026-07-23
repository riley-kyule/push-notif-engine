export interface DatabaseConfig {
  databaseUrl: string;
}

export interface RedisConfig {
  redisUrl: string;
}

export interface BrowserPushConfig {
  ackBaseUrl: string;
  sendConcurrency: number;
  queueConcurrency: number;
  transientFailureThreshold: number;
}

export interface MobilePushConfig {
  sendConcurrency: number;
  queueConcurrency: number;
  transientFailureThreshold: number;
}

function readConcurrencyEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredPublicApiUrl(): string {
  const value = process.env.BROWSER_PUSH_ACK_BASE_URL ?? process.env.PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!value || value.trim().length === 0) {
    throw new Error(
      "Missing required environment variable: set BROWSER_PUSH_ACK_BASE_URL (or PUBLIC_API_URL / NEXT_PUBLIC_API_URL) " +
        "to this server's real public API URL, e.g. https://push.exotic-online.com/api",
    );
  }

  return value;
}

export function loadDatabaseConfig(): DatabaseConfig {
  return { databaseUrl: readRequiredEnv("DATABASE_URL") };
}

export function loadRedisConfig(): RedisConfig {
  return { redisUrl: readRequiredEnv("REDIS_URL") };
}

export function loadBrowserPushConfig(): BrowserPushConfig {
  return {
    // This URL gets embedded in every push payload and fetched by the
    // subscriber's own browser (service worker), not by this server -- a
    // silent fallback to 127.0.0.1 here resolves to the *subscriber's*
    // machine, not ours, so every delivery acknowledgment fails forever with
    // no visible error anywhere except "sent" never turning into "delivered"
    // in the dashboard. Required, like DATABASE_URL/REDIS_URL, rather than
    // silently defaulting to a value that's broken for every real subscriber.
    ackBaseUrl: readRequiredPublicApiUrl(),
    // How many push-relay HTTP calls run concurrently per job. 200 is a safe default
    // for a single small VPS (bounded by ulimit -n and the DB pool); raise it if the
    // host has the file-descriptor headroom and the push relays aren't throttling you.
    sendConcurrency: readConcurrencyEnv("BROWSER_PUSH_SEND_CONCURRENCY", 200),
    // How many *jobs* (campaigns/one-off dispatches) this BullMQ Worker pulls and
    // processes at once — distinct from sendConcurrency above, which is the fanout
    // *within* a single job. BullMQ defaults this to 1 (jobs processed one at a
    // time) if left unset; we set it explicitly so it's a real, tunable decision.
    queueConcurrency: readConcurrencyEnv("BROWSER_PUSH_QUEUE_CONCURRENCY", 5),
    // Stop a job before one infrastructure outage becomes tens of thousands
    // of recipient failures. BullMQ retries the job later and the processor's
    // idempotency guard skips recipients that already succeeded.
    transientFailureThreshold: readConcurrencyEnv("BROWSER_PUSH_TRANSIENT_FAILURE_THRESHOLD", 10),
  };
}

export function loadMobilePushConfig(): MobilePushConfig {
  return {
    sendConcurrency: readConcurrencyEnv("MOBILE_PUSH_SEND_CONCURRENCY", 200),
    queueConcurrency: readConcurrencyEnv("MOBILE_PUSH_QUEUE_CONCURRENCY", 5),
    transientFailureThreshold: readConcurrencyEnv("MOBILE_PUSH_TRANSIENT_FAILURE_THRESHOLD", 10),
  };
}
