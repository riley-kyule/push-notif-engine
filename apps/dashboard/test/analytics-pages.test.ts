import assert from "node:assert/strict";
import test from "node:test";

import AnalyticsPage, { buildAnalyticsOverviewCards } from "../app/analytics/page";

test("analytics dashboard page exists", () => {
  assert.equal(typeof AnalyticsPage, "function");
});

test("analytics overview failures card surfaces the most common failure reason", () => {
  const cards = buildAnalyticsOverviewCards({
    totalSites: 8,
    totalSubscribers: 32100,
    activeSubscribers: 29800,
    activeCampaigns: 4,
    totalCampaigns: 19,
    totalPending: 14,
    totalSent: 900,
    totalDelivered: 880,
    totalFailed: 26,
    totalClicked: 74,
    deliveryRate: 97.73,
    clickThroughRate: 8.22,
    failedDeliveryReason: "410 Gone Subscription no longer valid",
    failedDeliveryReasonCount: 19,
  });

  const failuresCard = cards.find((card) => card.label === "Failures");

  assert.ok(failuresCard);
  assert.equal(failuresCard?.detail, "Most common cause: 410 Gone Subscription no longer valid (19 events)");
});
