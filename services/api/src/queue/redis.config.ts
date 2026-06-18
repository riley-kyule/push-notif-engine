export interface RedisConfig {
  redisUrl: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadRedisConfig(): RedisConfig {
  return {
    redisUrl: readRequiredEnv("REDIS_URL"),
  };
}
