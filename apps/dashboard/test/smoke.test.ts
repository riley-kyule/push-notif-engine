import assert from "node:assert/strict";
import test from "node:test";

import DashboardHome from "../app/page";
import { buildOverviewCards, buildPerformanceRankingCards } from "../app/_data/overview-summary-cards";

test("dashboard home component exists", () => {
  assert.equal(typeof DashboardHome, "function");
});

test("dashboard home summary cards link to report pages", () => {
  const cards = buildOverviewCards({
    totalSites: 3,
    totalSubscribers: 1000,
    activeSubscribers: 900,
    activeCampaigns: 4,
    totalCampaigns: 6,
    totalPending: 12,
    totalSent: 20,
    totalDelivered: 18,
    totalFailed: 2,
    totalClicked: 7,
    deliveryRate: 90,
    clickThroughRate: 35,
  });

  assert.deepEqual(
    cards.map((card) => card.href),
    [
      "/analytics?section=site&days=30&preset=30d&siteId=site-3",
      "/analytics?section=content&days=30&preset=30d",
      "/analytics?section=content&days=30&preset=30d&siteId=site-3",
      "/analytics?section=time&days=30&preset=30d&siteId=site-3",
      "/analytics?section=time&days=30&preset=30d&siteId=site-3",
      "/analytics?section=time&days=30&preset=30d&siteId=site-3",
    ],
  );
});

test("dashboard home ranking cards include highest and lowest performers", () => {
  const cards = buildPerformanceRankingCards({
    sites: [
      { siteId: "site-1", siteName: "Exotic Africa", totalSubscribers: 2400, totalDelivered: 0, totalSent: 0, totalFailed: 0, totalExpired: 0, totalClicked: 0, deliveryRate: 0, clickThroughRate: 7.5 },
      { siteId: "site-2", siteName: "Zebra Travel", totalSubscribers: 1200, totalDelivered: 0, totalSent: 0, totalFailed: 0, totalExpired: 0, totalClicked: 0, deliveryRate: 0, clickThroughRate: 1.2 },
      { siteId: "site-3", siteName: "All Sites", totalSubscribers: 4200, totalDelivered: 0, totalSent: 0, totalFailed: 0, totalExpired: 0, totalClicked: 0, deliveryRate: 0, clickThroughRate: 0 },
    ],
  });

  assert.equal(cards.length, 2);
  assert.equal(cards[0]?.highestItems[0]?.label, "Exotic Africa");
  assert.equal(cards[0]?.lowestItems[0]?.label, "Zebra Travel");
  assert.equal(cards[1]?.highestItems[0]?.label, "Exotic Africa");
  assert.equal(cards[1]?.lowestItems[0]?.label, "Zebra Travel");
});
