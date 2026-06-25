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
    async getContentPerformance(...args: never[]) {
      calls.push({ method: "getContentPerformance", args });
      return overrides.getContentPerformance ? overrides.getContentPerformance(...args) : [{ contentType: "promotion" }];
    },
    async getPeakHours(...args: never[]) {
      calls.push({ method: "getPeakHours", args });
      return overrides.getPeakHours ? overrides.getPeakHours(...args) : [{ hour: 18, newSubscribers: 12 }];
    },
    async exportReport(...args: never[]) {
      calls.push({ method: "exportReport", args });
      return overrides.exportReport ? overrides.exportReport(...args) : { filename: "analytics-overview-7d.csv", contentType: "text/csv; charset=utf-8", body: "metric,value" };
    },
  };

  return { service: new AnalyticsService(repository as never), calls };
}

test("analytics service proxies overview and reporting data", async () => {
  const { service, calls } = createService();

  await service.getOverview(7);
  await service.getCountryPerformance(7, "site-1");
  await service.getSitePerformance(7, "site-1");
  await service.getTimePerformance(7, "site-1");
  await service.getContentPerformance(7, "site-1");
  await service.exportReport({ report: "overview", days: 7 });

  assert.deepEqual(calls.map((call) => call.method), [
    "getOverview",
    "getCountryPerformance",
    "getSitePerformance",
    "getTimePerformance",
    "getContentPerformance",
    "getOverview",
  ]);

  assert.deepEqual(calls[1]?.args, [7, "site-1", undefined]);
  assert.deepEqual(calls[2]?.args, [7, "site-1", undefined]);
  assert.deepEqual(calls[3]?.args, [7, "site-1", undefined]);
  assert.deepEqual(calls[4]?.args, [7, "site-1", undefined]);
});

test("analytics service proxies peak-hours data", async () => {
  const { service, calls } = createService();

  const result = await service.getPeakHours(7, "site-1");

  assert.deepEqual(calls[0]?.args, [7, "site-1", undefined]);
  assert.deepEqual(result, [{ hour: 18, newSubscribers: 12 }]);
});

test("analytics service exports csv reports", async () => {
  const { service } = createService();
  const result = await service.exportReport({ report: "content-performance", days: 7 });

  assert.equal(result.filename, "analytics-content-performance-7d.csv");
  assert.equal(result.contentType, "text/csv; charset=utf-8");
  assert.match(String(result.body), /contentType/);
});

test("analytics service exports xlsx reports", async () => {
  const { service } = createService();
  const result = await service.exportReport({ report: "overview", days: 30, format: "xlsx" });

  assert.equal(result.filename, "analytics-overview-30d.xlsx");
  assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.ok(Buffer.isBuffer(result.body));
});

test("analytics service exports pdf reports", async () => {
  const { service } = createService();
  const result = await service.exportReport({ report: "overview", days: 30, format: "pdf" });

  assert.equal(result.filename, "analytics-overview-30d.pdf");
  assert.equal(result.contentType, "application/pdf");
  assert.ok(Buffer.isBuffer(result.body));
});
