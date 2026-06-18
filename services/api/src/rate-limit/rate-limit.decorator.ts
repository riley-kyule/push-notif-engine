import { SetMetadata } from "@nestjs/common";

import { RATE_LIMIT_METADATA_KEY } from "./rate-limit.constants";

export interface RateLimitOptions {
  limit: number;
  ttl: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_METADATA_KEY, options);
