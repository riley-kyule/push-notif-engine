import assert from "node:assert/strict";
import test from "node:test";

import { RestApiSendRateLimitGuard } from "./rest-api-send-rate-limit.guard";

function createContext(siteKeyId: string | undefined) {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return { site: siteKeyId ? { restApiKeyId: siteKeyId } : undefined };
        },
      };
    },
  } as never;
}

test("rest api send rate limit guard permits requests until the per-site-key limit is reached", async () => {
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
      return 60_000;
    },
  };

  const guard = new RestApiSendRateLimitGuard(redis as never);
  const context = createContext("rest_site_1");

  for (let i = 0; i < 30; i += 1) {
    assert.equal(await guard.canActivate(context), true);
  }

  await assert.rejects(
    () => guard.canActivate(context),
    (error: unknown) => typeof error === "object" && error !== null && "message" in error,
  );
});

test("rest api send rate limit guard scopes counters per site key, not per request", async () => {
  const counters = new Map<string, number>();
  const redis = {
    async incr(key: string) {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
    async pexpire() {
      return 1;
    },
    async pttl() {
      return 60_000;
    },
  };

  const guard = new RestApiSendRateLimitGuard(redis as never);

  for (let i = 0; i < 30; i += 1) {
    assert.equal(await guard.canActivate(createContext("rest_site_1")), true);
  }

  // A different site's key has its own independent counter -- it shouldn't
  // be throttled just because another site exhausted its own limit.
  assert.equal(await guard.canActivate(createContext("rest_site_2")), true);
});
