import assert from "node:assert/strict";
import test from "node:test";

import DashboardHome from "../app/page";
import CampaignsPage from "../app/campaigns/page";
import NewCampaignPage from "../app/campaigns/new/page";
import CampaignTaxonomiesPage from "../app/campaign-taxonomies/page";
import PlatformHealthPage from "../app/platform-health/page";

test("dashboard pages exist", () => {
  assert.equal(typeof DashboardHome, "function");
  assert.equal(typeof CampaignsPage, "function");
  assert.equal(typeof NewCampaignPage, "function");
  assert.equal(typeof CampaignTaxonomiesPage, "function");
  assert.equal(typeof PlatformHealthPage, "function");
});
