import assert from "node:assert/strict";
import test from "node:test";

import { buildOverviewCards } from "../app/_data/overview-summary-cards";

test("failed deliveries card shows the most common failure reason when available", () => {
  const cards = buildOverviewCards({
    totalSites: 4,
    totalSubscribers: 1280,
    activeSubscribers: 1024,
    activeCampaigns: 6,
    totalCampaigns: 18,
    totalPending: 12,
    totalSent: 240,
    totalDelivered: 220,
    totalFailed: 11,
    totalClicked: 31,
    deliveryRate: 91.67,
    clickThroughRate: 12.92,
    failedDeliveryReason: "410 Gone Subscription expired",
    failedDeliveryReasonCount: 7,
  });

  const failedCard = cards.find((card) => card.label === "Failed deliveries");

  assert.ok(failedCard);
  assert.equal(failedCard?.detail, "Most common cause: 410 Gone Subscription expired (7 events)");
});

test("failed deliveries card falls back when there are no failures", () => {
  const cards = buildOverviewCards({
    totalSites: 4,
    totalSubscribers: 1280,
    activeSubscribers: 1024,
    activeCampaigns: 6,
    totalCampaigns: 18,
    totalPending: 12,
    totalSent: 240,
    totalDelivered: 220,
    totalFailed: 0,
    totalClicked: 31,
    deliveryRate: 91.67,
    clickThroughRate: 12.92,
    failedDeliveryReason: null,
    failedDeliveryReasonCount: 0,
  });

  const failedCard = cards.find((card) => card.label === "Failed deliveries");

  assert.ok(failedCard);
  assert.equal(failedCard?.detail, "No failed deliveries yet");
});
