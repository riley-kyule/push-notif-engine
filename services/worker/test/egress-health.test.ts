import assert from "node:assert/strict";
import test from "node:test";

import { checkBrowserPushEgress } from "../src/egress-health";

test("egress health reports a successful probe", async () => {
  const health = await checkBrowserPushEgress(async () => undefined);

  assert.equal(health.status, "healthy");
  assert.equal(health.errorCode, null);
  assert.equal(health.errorMessage, null);
});

test("egress health preserves a DNS failure without throwing", async () => {
  const health = await checkBrowserPushEgress(async () => {
    throw Object.assign(new Error("getaddrinfo EAI_AGAIN fcm.googleapis.com"), { code: "EAI_AGAIN" });
  });

  assert.equal(health.status, "unhealthy");
  assert.equal(health.errorCode, "EAI_AGAIN");
  assert.match(health.errorMessage ?? "", /fcm\.googleapis\.com/);
});
