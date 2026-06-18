export interface DatabaseConfig {
  databaseUrl: string;
}

export interface RedisConfig {
  redisUrl: string;
}

export interface BrowserPushConfig {
  ackBaseUrl: string;
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
  };
}
