export interface DatabaseConfig {
  databaseUrl: string;
}

export interface RedisConfig {
  redisUrl: string;
}

export interface BrowserPushConfig {
  ackBaseUrl: string;
  sendConcurrency: number;
}

export interface MobilePushConfig {
  sendConcurrency: number;
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

export function loadDatabaseConfig(): DatabaseConfig {
  return { databaseUrl: readRequiredEnv("DATABASE_URL") };
}

export function loadRedisConfig(): RedisConfig {
  return { redisUrl: readRequiredEnv("REDIS_URL") };
}

export function loadBrowserPushConfig(): BrowserPushConfig {
  return {
    ackBaseUrl:
      process.env.BROWSER_PUSH_ACK_BASE_URL ??
      process.env.PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://127.0.0.1:3001/api",
    // How many push-relay HTTP calls run concurrently per job. 200 is a safe default
    // for a single small VPS (bounded by ulimit -n and the DB pool); raise it if the
    // host has the file-descriptor headroom and the push relays aren't throttling you.
    sendConcurrency: readConcurrencyEnv("BROWSER_PUSH_SEND_CONCURRENCY", 200),
  };
}

export function loadMobilePushConfig(): MobilePushConfig {
  return {
    sendConcurrency: readConcurrencyEnv("MOBILE_PUSH_SEND_CONCURRENCY", 200),
  };
}
