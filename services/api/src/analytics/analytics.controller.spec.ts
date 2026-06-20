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
    async getCountryPerformance(...args: never[]) {
      calls.push({ method: "getCountryPerformance", args });
      return overrides.getCountryPerformance ? overrides.getCountryPerformance(...args) : [];
    },
    async getSitePerformance(...args: never[]) {
      calls.push({ method: "getSitePerformance", args });
      return overrides.getSitePerformance ? overrides.getSitePerformance(...args) : [];
    },
    async getTimePerformance(...args: never[]) {
      calls.push({ method: "getTimePerformance", args });
      return overrides.getTimePerformance ? overrides.getTimePerformance(...args) : [];
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

test("analytics controller returns country, site, and time reports", async () => {
  const { controller, calls } = createController();

  const countries = await controller.getCountryPerformance("21");
  const sites = await controller.getSitePerformance(undefined);
  const time = await controller.getTimePerformance("7");

  assert.equal(countries.success, true);
  assert.equal(sites.success, true);
  assert.equal(time.success, true);
  assert.deepEqual(calls, [
    { method: "getCountryPerformance", args: [21] },
    { method: "getSitePerformance", args: [30] },
    { method: "getTimePerformance", args: [7] },
  ]);
});
