import assert from "node:assert/strict";
import test from "node:test";

import { AnalyticsService } from "./analytics.service";

function createService(overrides: Partial<Record<string, (...args: never[]) => unknown>> = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const repository = {
    async getCampaignStats(...args: never[]) {
      calls.push({ method: "getCampaignStats", args });
      return overrides.getCampaignStats ? overrides.getCampaignStats(...args) : { sent: 1 };
    },
    async getSiteOverview(...args: never[]) {
      calls.push({ method: "getSiteOverview", args });
      return overrides.getSiteOverview ? overrides.getSiteOverview(...args) : { totalSubscribers: 1 };
    },
    async getSiteDeliveryStats(...args: never[]) {
      calls.push({ method: "getSiteDeliveryStats", args });
      return overrides.getSiteDeliveryStats ? overrides.getSiteDeliveryStats(...args) : { totalDelivered: 1 };
    },
    async getSubscriberGrowth(...args: never[]) {
      calls.push({ method: "getSubscriberGrowth", args });
      return overrides.getSubscriberGrowth ? overrides.getSubscriberGrowth(...args) : [];
    },
    async getOverview(...args: never[]) {
      calls.push({ method: "getOverview", args });
      return overrides.getOverview ? overrides.getOverview(...args) : { totalSites: 1 };
    },
    async getCountryPerformance(...args: never[]) {
      calls.push({ method: "getCountryPerformance", args });
      return overrides.getCountryPerformance ? overrides.getCountryPerformance(...args) : [{ country: "South Africa" }];
    },
    async getSitePerformance(...args: never[]) {
      calls.push({ method: "getSitePerformance", args });
      return overrides.getSitePerformance ? overrides.getSitePerformance(...args) : [{ siteId: "site-1" }];
    },
    async getTimePerformance(...args: never[]) {
      calls.push({ method: "getTimePerformance", args });
      return overrides.getTimePerformance ? overrides.getTimePerformance(...args) : [{ hour: 10 }];
    },
  };

  return { service: new AnalyticsService(repository as never), calls };
}

test("analytics service proxies overview and reporting data", async () => {
  const { service, calls } = createService();

  await service.getOverview(7);
  await service.getCountryPerformance(7);
  await service.getSitePerformance(7);
  await service.getTimePerformance(7);

  assert.deepEqual(calls.map((call) => call.method), [
    "getOverview",
    "getCountryPerformance",
    "getSitePerformance",
    "getTimePerformance",
  ]);
});

