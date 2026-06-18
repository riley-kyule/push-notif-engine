import assert from "node:assert/strict";
import test from "node:test";

import { AnalyticsController } from "./analytics.controller";

function createController(overrides: Partial<Record<string, (...args: never[]) => unknown>> = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    async getOverview(...args: never[]) {
      calls.push({ method: "getOverview", args });
      return overrides.getOverview ? overrides.getOverview(...args) : { totalSites: 1 };
    },
    async getCampaignStats(...args: never[]) {
      calls.push({ method: "getCampaignStats", args });
      return overrides.getCampaignStats ? overrides.getCampaignStats(...args) : { sent: 1 };
    },
    async getSiteOverview(...args: never[]) {
      calls.push({ method: "getSiteOverview", args });
      return overrides.getSiteOverview ? overrides.getSiteOverview(...args) : { totalSubscribers: 1 };
    },
    async getSubscriberGrowth(...args: never[]) {
      calls.push({ method: "getSubscriberGrowth", args });
      return overrides.getSubscriberGrowth ? overrides.getSubscriberGrowth(...args) : [];
    },
  };

  return { controller: new AnalyticsController(service as never), calls };
}

test("analytics controller returns overview data with default day window", async () => {
  const { controller, calls } = createController();
  const result = await controller.getOverview(undefined);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { totalSites: 1 });
  assert.deepEqual(calls, [{ method: "getOverview", args: [30] }]);
});

test("analytics controller parses a custom days query for overview", async () => {
  const { controller, calls } = createController();
  await controller.getOverview("7");

  assert.deepEqual(calls, [{ method: "getOverview", args: [7] }]);
});

test("analytics controller returns campaign stats", async () => {
  const { controller, calls } = createController();
  const result = await controller.getCampaignStats("campaign-1");

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { sent: 1 });
  assert.deepEqual(calls, [{ method: "getCampaignStats", args: ["campaign-1"] }]);
});

test("analytics controller returns site overview and subscriber growth", async () => {
  const { controller, calls } = createController();

  const overview = await controller.getSiteOverview("site-1", "14");
  const growth = await controller.getSubscriberGrowth("site-1", undefined);

  assert.equal(overview.success, true);
  assert.equal(growth.success, true);
  assert.deepEqual(calls, [
    { method: "getSiteOverview", args: ["site-1", 14] },
    { method: "getSubscriberGrowth", args: ["site-1", 30] },
  ]);
});
