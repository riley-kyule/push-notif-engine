import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type IORedis from "ioredis";

import { DEFAULT_RATE_LIMIT, RATE_LIMIT_METADATA_KEY, RATE_LIMIT_REDIS } from "./rate-limit.constants";
import type { RateLimitOptions } from "./rate-limit.decorator";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMIT_REDIS) private readonly redis: IORedis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_METADATA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RATE_LIMIT;

    const request = context.switchToHttp().getRequest<{ ip?: string; headers?: Record<string, string | string[]> }>();
    const ip = this.resolveClientIp(request);
    const controllerName = context.getClass()?.name ?? "UnknownController";
    const handlerName = context.getHandler()?.name ?? "unknownHandler";
    const routeId = `${controllerName}:${handlerName}`;
    const key = `rate-limit:${routeId}:${ip}`;

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.pexpire(key, options.ttl);
    }

    if (current > options.limit) {
      const ttl = await this.redis.pttl(key);
      throw new HttpException(
        {
          message: "Too many requests",
          retryAfterMs: ttl > 0 ? ttl : options.ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveClientIp(request: { ip?: string; headers?: Record<string, string | string[]> }): string {
    const forwarded = request.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      const firstForwarded = forwarded.split(",")[0]!;
      return firstForwarded.trim();
    }

    if (Array.isArray(forwarded)) {
      const firstForwarded = forwarded[0];
      if (typeof firstForwarded === "string" && firstForwarded.length > 0) {
        const firstSegment = firstForwarded.split(",")[0]!;
        return firstSegment.trim();
      }
    }

    return request.ip ?? "unknown";
  }
}
