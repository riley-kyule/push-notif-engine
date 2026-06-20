import assert from "node:assert/strict";
import test from "node:test";

import { getAnalyticsDashboardData } from "../app/_data/analytics";

test("analytics dashboard data resolves a default reporting model", async () => {
  const data = await getAnalyticsDashboardData({ days: "7" });

  assert.equal(data.days, 7);
  assert.ok(data.sites.length > 0);
  assert.ok(data.selectedSite);
  assert.ok(data.selectedCampaign);
  assert.equal(typeof data.rangeLabel, "string");
});
