import assert from "node:assert/strict";
import test from "node:test";

import DashboardHome from "../app/page";
import CampaignsPage from "../app/campaigns/page";
import NewCampaignPage from "../app/campaigns/new/page";

test("dashboard pages exist", () => {
  assert.equal(typeof DashboardHome, "function");
  assert.equal(typeof CampaignsPage, "function");
  assert.equal(typeof NewCampaignPage, "function");
});
