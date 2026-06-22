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
            lastSeenAt: "2026-06-22T00:00:00.000Z",
            uptimeMs: 123456,
            redisLatencyMs: 4,
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
