import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type IORedis from "ioredis";

import { RATE_LIMIT_REDIS } from "../rate-limit/rate-limit.constants";
import type { SiteRecord } from "../sites/sites.types";

const SEND_LIMIT = 30;
const SEND_TTL_MS = 60_000;

// Keyed by the site's REST API key id rather than IP: a CRM integration
// sends on behalf of many sites from one server, so an IP-scoped limit would
// throttle unrelated sites together, and wouldn't bound a single leaked
// site key's blast radius at all if the caller rotates IPs. Must run after
// RestApiAuthGuard, which populates request.site.
@Injectable()
export class RestApiSendRateLimitGuard implements CanActivate {
  constructor(@Inject(RATE_LIMIT_REDIS) private readonly redis: IORedis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ site?: SiteRecord }>();
    const keyId = request.site?.restApiKeyId ?? "unknown";
    const key = `rate-limit:rest-api-send:${keyId}`;

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.pexpire(key, SEND_TTL_MS);
    }

    if (current > SEND_LIMIT) {
      const ttl = await this.redis.pttl(key);
      throw new HttpException(
        { message: "Too many notifications sent recently for this site", retryAfterMs: ttl > 0 ? ttl : SEND_TTL_MS },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
