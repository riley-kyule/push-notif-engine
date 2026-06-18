import { Module } from "@nestjs/common";
import IORedis from "ioredis";

import { loadRedisConfig } from "../queue/redis.config";
import { RATE_LIMIT_REDIS } from "./rate-limit.constants";
import { RateLimitGuard } from "./rate-limit.guard";

export function createRateLimitRedisClient(): IORedis {
  const config = loadRedisConfig();
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  }) as IORedis;
}

@Module({
  providers: [
    {
      provide: RATE_LIMIT_REDIS,
      useFactory: createRateLimitRedisClient,
    },
    RateLimitGuard,
  ],
  exports: [RATE_LIMIT_REDIS, RateLimitGuard],
})
export class RateLimitModule {}
