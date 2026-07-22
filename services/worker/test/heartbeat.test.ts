import assert from "node:assert/strict";
import test from "node:test";

import { createHeartbeatPayload, heartbeatField } from "../src/heartbeat";

test("heartbeat helpers build stable redis keys and payloads", () => {
  assert.equal(heartbeatField(1234), "worker:1234");

  const egress = {
    status: "healthy" as const,
    checkedAt: new Date().toISOString(),
    latencyMs: 12,
    errorCode: null,
    errorMessage: null,
  };
  const payload = createHeartbeatPayload("worker-1234", egress);
  assert.equal(payload.label, "worker-1234");
  assert.equal(typeof payload.lastSeenAt, "string");
  assert.equal(typeof payload.uptimeMs, "number");
  assert.equal(typeof payload.redisLatencyMs, "number");
  assert.deepEqual(payload.browserPushEgress, egress);
});
