import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneCampaign,
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  listSites,
  scheduleCampaign,
} from "../app/api/dashboard/_store";

test("dashboard store supports campaign lifecycle operations", () => {
  const sites = listSites();
  assert.ok(sites.length > 0);

  const created = createCampaign({
    siteId: sites[0].id,
    name: "Test Campaign",
    channel: "web",
    type: "instant",
    title: "Hello",
    message: "World",
    url: "https://example.com",
    imageUrl: null,
    iconUrl: null,
    buttons: [{ label: "Open", url: "https://example.com" }],
    expirationAt: null,
    status: "draft",
    scheduledAt: null,
    timezone: "Africa/Nairobi",
    recurrenceType: null,
    recurrenceInterval: null,
    recurrenceUntilAt: null,
    clonedFromCampaignId: null,
    sentAt: null,
  });

  assert.equal(created.title, "Hello");
  assert.ok(listCampaigns().some((campaign) => campaign.id === created.id));

  const scheduled = scheduleCampaign(created.id, {
    scheduledAt: "2026-06-18T09:00:00.000Z",
    timezone: "Africa/Nairobi",
  });

  assert.equal(scheduled?.status, "scheduled");

  const cloned = cloneCampaign(created.id, "Test Campaign Copy");
  assert.ok(cloned);
  assert.equal(cloned?.name, "Test Campaign Copy");

  assert.ok(getCampaign(created.id));
  assert.equal(deleteCampaign(created.id), true);
});
