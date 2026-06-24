import assert from "node:assert/strict";
import test from "node:test";

import { formatTimeBucketLabel, getAnalyticsDashboardData } from "../app/_data/analytics";

test("formatTimeBucketLabel matches the selected range's granularity", () => {
  assert.equal(formatTimeBucketLabel("2026-06-24T14:00:00.000Z", 1), "14:00");
  assert.equal(formatTimeBucketLabel("2026-06-24T00:00:00.000Z", 7), "Wed");
  assert.equal(formatTimeBucketLabel("2026-06-24T00:00:00.000Z", 30), "Jun 24");
});

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

test("analytics dashboard data falls back to all sites when no sites exist", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/sites")) {
        return new Response(JSON.stringify({ success: true, data: { items: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.endsWith("/campaigns")) {
        return new Response(JSON.stringify({ success: true, data: { items: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const data = await getAnalyticsDashboardData({ preset: "30d", days: "30" });
    assert.equal(data.selectedSite.id, "site-3");
    assert.equal(data.selectedSite.name, "All Sites");
    assert.ok(data.sitePerformance.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requesting siteId 'site-3' resolves to the All Sites aggregate even with real sites present, instead of silently defaulting to the newest one", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      // A real backend would 404 this -- if the code ever calls
      // getSiteById("site-3") instead of treating it as the sentinel, this
      // wrong-but-200 response would get picked up as `selectedSite`,
      // exposing the bug (defaulting to a single real site instead of the
      // cross-site aggregate).
      if (url.endsWith("/sites/site-3")) {
        return new Response(
          JSON.stringify({ success: true, data: { id: "site-3", name: "Newest Real Site", country: "GH" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.endsWith("/sites")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              items: [
                { id: "site-newest", name: "Newest Real Site", country: "GH" },
                { id: "site-oldest", name: "Oldest Real Site", country: "KE" },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.includes("/analytics/sites-performance")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              { siteId: "site-newest", siteName: "Newest Real Site", totalSubscribers: 10, totalDelivered: 0, totalSent: 0, totalFailed: 0, totalExpired: 0, totalClicked: 0, deliveryRate: 0, clickThroughRate: 0 },
              { siteId: "site-oldest", siteName: "Oldest Real Site", totalSubscribers: 500, totalDelivered: 0, totalSent: 0, totalFailed: 0, totalExpired: 0, totalClicked: 0, deliveryRate: 0, clickThroughRate: 0 },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.endsWith("/campaigns")) {
        return new Response(JSON.stringify({ success: true, data: { items: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const data = await getAnalyticsDashboardData({ preset: "30d", days: "30", siteId: "site-3" });
    assert.equal(data.selectedSite.id, "site-3");
    assert.equal(data.selectedSite.name, "All Sites");
    assert.equal(data.sitePerformance.length, 2);
    assert.deepEqual(
      data.sitePerformance.map((site) => site.siteId).sort(),
      ["site-newest", "site-oldest"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
