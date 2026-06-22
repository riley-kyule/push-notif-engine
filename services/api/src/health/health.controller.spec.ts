import assert from "node:assert/strict";
import test from "node:test";

import { HealthController } from "./health.controller";

test("health controller reports database and storage status", async () => {
  const controller = new HealthController(
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
      async getPlatformHealth() {
        return {
          status: "healthy",
          score: 100,
          checkedAt: new Date().toISOString(),
          components: [],
          queueDepth: [],
          workerHeartbeats: [],
          siteHealth: { highestDelivery: [], lowestDelivery: [] },
        };
      },
    } as never,
  );

  const health = await controller.getHealth();
  const storage = await controller.getStorageHealth();

  assert.equal(health.data.status, "ok");
  assert.equal(storage.data.status, "ok");
});

test("health controller rejects when storage is unreachable", async () => {
  const controller = new HealthController(
    {
      async query() {
        return { rows: [] };
      },
    } as never,
    {
      async ping() {
        return false;
      },
    } as never,
    {
      async getPlatformHealth() {
        return {
          status: "unhealthy",
          score: 0,
          checkedAt: new Date().toISOString(),
          components: [],
          queueDepth: [],
          workerHeartbeats: [],
          siteHealth: { highestDelivery: [], lowestDelivery: [] },
        };
      },
    } as never,
  );

  await assert.rejects(() => controller.getStorageHealth(), /Campaign media storage unreachable/);
});

test("health controller returns platform summary", async () => {
  const controller = new HealthController(
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
      async getPlatformHealth() {
        return {
          status: "degraded",
          score: 70,
          checkedAt: "2026-06-22T00:00:00.000Z",
          components: [
            { key: "database", label: "Database", status: "healthy", detail: "", score: 40, weight: 40 },
            { key: "queue", label: "Queue broker", status: "healthy", detail: "", score: 30, weight: 30 },
            { key: "storage", label: "Media storage", status: "unhealthy", detail: "", score: 0, weight: 30 },
          ],
          queueDepth: [],
          workerHeartbeats: [],
          siteHealth: { highestDelivery: [], lowestDelivery: [] },
        };
      },
    } as never,
  );

  const health = await controller.getPlatformHealth();

  assert.equal(health.success, true);
  assert.equal(health.data.score, 70);
  assert.equal(health.data.status, "degraded");
});
