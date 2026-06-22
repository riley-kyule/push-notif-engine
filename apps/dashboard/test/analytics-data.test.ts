import assert from "node:assert/strict";
import test from "node:test";

import { getAnalyticsDashboardData } from "../app/_data/analytics";

test("analytics dashboard data resolves a custom reporting range", async () => {
  const data = await getAnalyticsDashboardData({
    preset: "custom",
    startDate: "2026-06-01",
    endDate: "2026-06-07",
    compareMode: "custom",
    compareStartDate: "2026-05-25",
    compareEndDate: "2026-05-31",
  });

  assert.equal(data.selectedPreset, "custom");
  assert.equal(data.compareMode, "custom");
  assert.equal(data.days, 7);
  assert.ok(data.sites.length > 0);
  assert.ok(data.selectedSite);
  assert.ok(data.selectedCampaign);
  assert.equal(typeof data.rangeLabel, "string");
  assert.ok(data.comparisonOverview);
  assert.ok(data.comparisonRange);
  assert.equal(data.range.startDate, "2026-06-01");
  assert.equal(data.range.endDate, "2026-06-07");
  assert.equal(data.comparisonRange?.startDate, "2026-05-25");
  assert.equal(data.comparisonRange?.endDate, "2026-05-31");
});

test("analytics dashboard data resolves a preset with previous-period comparison", async () => {
  const data = await getAnalyticsDashboardData({
    preset: "7d",
    days: "7",
    compareMode: "previous",
  });

  assert.equal(data.selectedPreset, "7d");
  assert.equal(data.compareMode, "previous");
  assert.equal(data.days, 7);
  assert.ok(data.comparisonRange);
  assert.equal(data.comparisonRange?.days, 7);
  assert.equal(data.comparisonRange?.startDate < data.range.startDate, true);
});

test("analytics dashboard data resolves all sites as the global reporting scope", async () => {
  const data = await getAnalyticsDashboardData({
    preset: "30d",
    days: "30",
    siteId: "site-3",
  });

  assert.equal(data.selectedSite.id, "site-3");
  assert.equal(data.selectedSite.name, "All Sites");
  assert.ok(data.sitePerformance.length > 0);
  assert.ok(data.countryPerformance.length > 0);
  assert.ok(data.timePerformance.length > 0);
  assert.ok(data.contentPerformance.length > 0);
});
