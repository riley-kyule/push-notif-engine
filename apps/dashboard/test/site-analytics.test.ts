import assert from "node:assert/strict";
import test from "node:test";

import { getSiteAnalytics } from "../lib/site-analytics";

test("site analytics returns an honest empty state when the API is unavailable", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiUrl = process.env.DASHBOARD_API_BASE_URL;

  try {
    process.env.NODE_ENV = "development";
    process.env.DASHBOARD_API_BASE_URL = "http://127.0.0.1:65535/api";

    const analytics = await getSiteAnalytics({
      id: "site-1",
      name: "Exotic Africa",
      url: "https://exotic-africa.com",
      country: "South Africa",
      language: "en",
      platform: "WordPress",
      status: "active",
      subscribers: 2418400,
      vapidPublicKey: "BExoticKey1",
    });

    // The real subscriber count is already known from the site record, so
    // it's preserved -- but everything that would require a successful API
    // call must come back empty/zero, never invented.
    assert.equal(analytics.totalSubscribers, 2418400);
    assert.equal(analytics.activeSubscribers, 0);
    assert.deepEqual(analytics.last30Days.subscriberGrowth, []);
    assert.equal(analytics.last30Days.totalDelivered, 0);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DASHBOARD_API_BASE_URL = originalApiUrl;
  }
});
