export const RATE_LIMIT_REDIS = Symbol("RATE_LIMIT_REDIS");
export const RATE_LIMIT_METADATA_KEY = "epe:rate-limit";

export const DEFAULT_RATE_LIMIT = {
  limit: 120,
  ttl: 60_000,
} as const;
