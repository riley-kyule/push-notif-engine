import assert from "node:assert/strict";
import test from "node:test";

import { PlatformHealthService } from "./platform-health.service";

test("platform health service scores all healthy components as 100", async () => {
  const service = new PlatformHealthService(
    {
      async query() {
        return { rows: [] };
      },
    } as never,
    {
      async ping() {
        return true;
      },
    } as never,
    {
      async ping() {
        return "PONG";
      },
      async llen() {
        return 0;
      },
      async zcard() {
        return 0;
      },
      async hgetall() {
        return {
          "worker:123": JSON.stringify({
            label: "worker-123",
            lastSeenAt: new Date().toISOString(),
            uptimeMs: 123456,
            redisLatencyMs: 4,
            browserPushEgress: {
              status: "healthy",
              checkedAt: new Date().toISOString(),
              latencyMs: 15,
              errorCode: null,
              errorMessage: null,
            },
          }),
        };
      },
    } as never,
    {
      async getSitePerformance() {
        return [
          { siteId: "site-1", siteName: "Alpha", deliveryRate: 98, clickThroughRate: 5, totalDelivered: 100, totalFailed: 2 },
          { siteId: "site-2", siteName: "Beta", deliveryRate: 67, clickThroughRate: 3, totalDelivered: 50, totalFailed: 10 },
        ];
      },
    } as never,
  );

  const summary = await service.getPlatformHealth();

  assert.equal(summary.score, 100);
  assert.equal(summary.status, "healthy");
  assert.equal(summary.components.every((component) => component.status === "healthy"), true);
});

test("platform health service degrades when a component is down", async () => {
  const service = new PlatformHealthService(
    {
      async query() {
        throw new Error("db down");
      },
    } as never,
    {
      async ping() {
        return false;
      },
    } as never,
    {
      async ping() {
        throw new Error("redis down");
      },
      async llen() {
        return 0;
      },
      async zcard() {
        return 0;
      },
      async hgetall() {
        return {};
      },
    } as never,
    {
      async getSitePerformance() {
        throw new Error("analytics down");
      },
    } as never,
  );

  const summary = await service.getPlatformHealth();

  assert.equal(summary.score, 0);
  assert.equal(summary.status, "unhealthy");
  assert.equal(summary.components.some((component) => component.status === "unhealthy"), true);
});

test("platform health prunes offline worker ghosts once a live heartbeat exists", async () => {
  const deletedFields: string[] = [];
  const now = new Date().toISOString();
  const longDead = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

  const service = new PlatformHealthService(
    {
      async query() {
        return { rows: [] };
      },
    } as never,
    {
      async ping() {
        return true;
      },
    } as never,
    {
      async ping() {
        return "PONG";
      },
      async llen() {
        return 0;
      },
      async zcard() {
        return 0;
      },
      async hgetall() {
        return {
          "worker:1": JSON.stringify({
            label: "worker-1",
            lastSeenAt: now,
            uptimeMs: 1000,
            redisLatencyMs: 1,
            browserPushEgress: {
              status: "healthy",
              checkedAt: now,
              latencyMs: 10,
              errorCode: null,
              errorMessage: null,
            },
          }),
          "worker:2": JSON.stringify({ label: "worker-2", lastSeenAt: longDead, uptimeMs: 1000, redisLatencyMs: 1 }),
          "worker:3": JSON.stringify({ label: "worker-3", lastSeenAt: longDead, uptimeMs: 1000, redisLatencyMs: 1 }),
        };
      },
      async hdel(_key: string, ...fields: string[]) {
        deletedFields.push(...fields);
        return fields.length;
      },
    } as never,
    {
      async getSitePerformance() {
        return [];
      },
    } as never,
  );

  const summary = await service.getPlatformHealth();

  assert.deepEqual(summary.workerHeartbeats.map((entry) => entry.key), ["worker:1"]);
  assert.deepEqual(deletedFields.sort(), ["worker:2", "worker:3"]);
  assert.equal(summary.alerts.some((alert) => alert.key === "workers:stale"), false);
});

test("platform health keeps the single most recent ghost when every worker is offline", async () => {
  const deletedFields: string[] = [];
  const olderDead = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const mostRecentDead = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const service = new PlatformHealthService(
    {
      async query() {
        return { rows: [] };
      },
    } as never,
    {
      async ping() {
        return true;
      },
    } as never,
    {
      async ping() {
        return "PONG";
      },
      async llen() {
        return 0;
      },
      async zcard() {
        return 0;
      },
      async hgetall() {
        return {
          "worker:1": JSON.stringify({ label: "worker-1", lastSeenAt: olderDead, uptimeMs: 1000, redisLatencyMs: 1 }),
          "worker:2": JSON.stringify({ label: "worker-2", lastSeenAt: mostRecentDead, uptimeMs: 1000, redisLatencyMs: 1 }),
        };
      },
      async hdel(_key: string, ...fields: string[]) {
        deletedFields.push(...fields);
        return fields.length;
      },
    } as never,
    {
      async getSitePerformance() {
        return [];
      },
    } as never,
  );

  const summary = await service.getPlatformHealth();

  assert.deepEqual(summary.workerHeartbeats.map((entry) => entry.key), ["worker:2"]);
  assert.deepEqual(deletedFields, ["worker:1"]);
  assert.equal(summary.alerts.some((alert) => alert.key === "workers:stale"), true);
});

test("platform health degrades and alerts when a live worker cannot reach FCM", async () => {
  const now = new Date().toISOString();
  const service = new PlatformHealthService(
    { async query() { return { rows: [] }; } } as never,
    { async ping() { return true; } } as never,
    {
      async ping() { return "PONG"; },
      async llen() { return 0; },
      async zcard() { return 0; },
      async hgetall() {
        return {
          "worker:1": JSON.stringify({
            label: "worker-1",
            lastSeenAt: now,
            uptimeMs: 1000,
            redisLatencyMs: 1,
            browserPushEgress: {
              status: "unhealthy",
              checkedAt: now,
              latencyMs: 2,
              errorCode: "EAI_AGAIN",
              errorMessage: "getaddrinfo EAI_AGAIN fcm.googleapis.com",
            },
          }),
        };
      },
    } as never,
    { async getSitePerformance() { return []; } } as never,
  );

  const summary = await service.getPlatformHealth();

  assert.equal(summary.score, 80);
  assert.equal(summary.status, "degraded");
  assert.equal(summary.components.find((component) => component.key === "push-egress")?.status, "unhealthy");
  assert.equal(summary.alerts.some((alert) => alert.key === "component:push-egress"), true);
});
