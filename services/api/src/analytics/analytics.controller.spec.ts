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
    async getCampaignStatsBulk(...args: never[]) {
      calls.push({ method: "getCampaignStatsBulk", args });
      return overrides.getCampaignStatsBulk ? overrides.getCampaignStatsBulk(...args) : {};
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
    async getContentPerformance(...args: never[]) {
      calls.push({ method: "getContentPerformance", args });
      return overrides.getContentPerformance ? overrides.getContentPerformance(...args) : [];
    },
    async getPeakHours(...args: never[]) {
      calls.push({ method: "getPeakHours", args });
      return overrides.getPeakHours ? overrides.getPeakHours(...args) : [];
    },
    async exportReport(...args: never[]) {
      calls.push({ method: "exportReport", args });
      return overrides.exportReport ? overrides.exportReport(...args) : { filename: "analytics-overview-30d.csv", contentType: "text/csv; charset=utf-8", body: "metric,value" };
    },
  };

  return { controller: new AnalyticsController(service as never, {} as never), calls };
}

test("analytics controller returns overview data with default day window", async () => {
  const { controller, calls } = createController();
  const result = await controller.getOverview(undefined);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { totalSites: 1 });
  assert.deepEqual(calls, [{ method: "getOverview", args: [30, undefined, undefined] }]);
});

test("analytics controller parses a custom days query for overview", async () => {
  const { controller, calls } = createController();
  await controller.getOverview("7");

  assert.deepEqual(calls, [{ method: "getOverview", args: [7, undefined, undefined] }]);
});

test("analytics controller passes siteId through to scope the overview", async () => {
  const { controller, calls } = createController();
  await controller.getOverview("7", "site-1");

  assert.deepEqual(calls, [{ method: "getOverview", args: [7, "site-1", undefined] }]);
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
    { method: "getCountryPerformance", args: [21, undefined, undefined] },
    { method: "getSitePerformance", args: [30, undefined, undefined] },
    { method: "getTimePerformance", args: [7, undefined, undefined] },
  ]);
});

test("analytics controller returns content performance", async () => {
  const { controller, calls } = createController();

  const content = await controller.getContentPerformance("14");

  assert.equal(content.success, true);
  assert.deepEqual(calls, [{ method: "getContentPerformance", args: [14, undefined, undefined] }]);
});

test("analytics controller returns peak-hours data", async () => {
  const { controller, calls } = createController();

  const result = await controller.getPeakHours("14", "site-1");

  assert.equal(result.success, true);
  assert.deepEqual(calls, [{ method: "getPeakHours", args: [14, "site-1", undefined] }]);
});

test("analytics controller exports csv reports", async () => {
  const { controller, calls } = createController();
  const response = { setHeader() {} };
  const csv = await controller.exportReport(response as never, "7", "content-performance");

  assert.match(String(csv), /metric|contentType/);
  assert.deepEqual(calls, [{ method: "exportReport", args: [{ days: 7, report: "content-performance" }] }]);
});

test("analytics controller exports xlsx and pdf reports", async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const controller = new AnalyticsController(
    {
      async exportReport(...args: never[]) {
        calls.push({ method: "exportReport", args });
        return { filename: "analytics-overview-7d.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: Buffer.from("xlsx") };
      },
    } as never,
    {} as never,
  );

  const response = { setHeader() {} };
  const xlsx = await controller.exportReport(response as never, "7", "overview", "xlsx");
  assert.ok(Buffer.isBuffer(xlsx));
  assert.deepEqual(calls, [{ method: "exportReport", args: [{ days: 7, report: "overview", format: "xlsx" }] }]);
});

test("analytics controller builds a Google Sheets authorize URL embedding report and days in state", () => {
  const sheetsClient = { buildAuthorizeUrl: (state: string) => `https://accounts.google.com/auth?state=${state}` };
  const controller = new AnalyticsController({} as never, sheetsClient as never);

  const result = controller.getGoogleSheetsAuthorizeUrl("content-performance", "14");

  assert.equal(result.success, true);
  assert.match(result.data.authorizeUrl, /^https:\/\/accounts\.google\.com\/auth\?state=/);
  const encoded = result.data.state.split(".")[1] ?? "";
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  assert.deepEqual(payload, { report: "content-performance", days: 14 });
});

test("analytics controller exchanges a Google Sheets code and returns the created spreadsheet URL", async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const reportRows = { headers: ["metric", "value"], rows: [["totalSubscribers", 10]] };
  const service = {
    async getReportRows(...args: never[]) {
      calls.push({ method: "getReportRows", args });
      return reportRows;
    },
  };
  const sheetsClient = {
    async exchangeCode(...args: never[]) {
      calls.push({ method: "exchangeCode", args });
      return "access-token";
    },
    async createSpreadsheet(...args: never[]) {
      calls.push({ method: "createSpreadsheet", args });
      return "https://docs.google.com/spreadsheets/d/abc123";
    },
  };
  const controller = new AnalyticsController(service as never, sheetsClient as never);

  const encodedState = Buffer.from(JSON.stringify({ report: "overview", days: 30 })).toString("base64url");
  const result = await controller.exchangeGoogleSheetsCode("auth-code", `nonce123.${encodedState}`);

  assert.equal(result.success, true);
  assert.equal(result.data.spreadsheetUrl, "https://docs.google.com/spreadsheets/d/abc123");
  const [exchangeCall, reportCall, createCall] = calls;
  assert.deepEqual(exchangeCall, { method: "exchangeCode", args: ["auth-code"] });
  assert.deepEqual(reportCall, { method: "getReportRows", args: [{ report: "overview", days: 30 }] });
  assert.equal(createCall?.method, "createSpreadsheet");
  assert.equal(createCall?.args[0], "access-token");
  assert.deepEqual(createCall?.args[2], reportRows.headers);
  assert.deepEqual(createCall?.args[3], reportRows.rows);
});

test("analytics controller rejects a Google Sheets exchange missing code or state", async () => {
  const controller = new AnalyticsController({} as never, {} as never);

  await assert.rejects(() => controller.exchangeGoogleSheetsCode("", "state"));
  await assert.rejects(() => controller.exchangeGoogleSheetsCode("code", ""));
});

test("analytics controller keeps only well-formed uuids in bulk campaign stats ids", async () => {
  const { controller, calls } = createController();
  const valid = "0b8f4a4e-2f0f-4d34-9c65-0d0f6f0a1b2c";

  const result = await controller.getCampaignStatsBulk(` ${valid} ,not-a-uuid,,`);

  assert.equal(result.success, true);
  assert.deepEqual(calls, [{ method: "getCampaignStatsBulk", args: [[valid]] }]);
});

test("analytics controller treats a missing ids query as an empty bulk request", async () => {
  const { controller, calls } = createController();

  const result = await controller.getCampaignStatsBulk(undefined);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {});
  assert.deepEqual(calls, [{ method: "getCampaignStatsBulk", args: [[]] }]);
});
