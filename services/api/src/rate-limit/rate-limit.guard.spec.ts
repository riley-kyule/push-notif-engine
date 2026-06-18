import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_RATE_LIMIT } from "./rate-limit.constants";
import { RateLimitGuard } from "./rate-limit.guard";

test("rate limit guard permits requests until the limit is reached", async () => {
  let counter = 0;
  const redis = {
    async incr() {
      counter += 1;
      return counter;
    },
    async pexpire() {
      return 1;
    },
    async pttl() {
      return DEFAULT_RATE_LIMIT.ttl;
    },
  };

  const guard = new RateLimitGuard(
    {
      getAllAndOverride() {
        return { limit: 2, ttl: 60_000 };
      },
    } as never,
    redis as never,
  );

  const context = {
    getClass() {
      return { name: "AuthController" };
    },
    getHandler() {
      return { name: "login" };
    },
    switchToHttp() {
      return {
        getRequest() {
          return { ip: "127.0.0.1" };
        },
      };
    },
  };

  assert.equal(await guard.canActivate(context as never), true);
  assert.equal(await guard.canActivate(context as never), true);

  await assert.rejects(
    async () => {
      await guard.canActivate(context as never);
    },
    (error: unknown) => typeof error === "object" && error !== null && "message" in error,
  );
});
