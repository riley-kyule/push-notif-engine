import assert from "node:assert/strict";
import test from "node:test";

import { CampaignsController } from "./campaigns.controller";

test("campaigns controller returns created campaign data", async () => {
  const calls: Array<string> = [];
  const service = {
    async createCampaign() {
      calls.push("create");
      return { id: "campaign-1" };
    },
    async listCampaigns() {
      calls.push("list");
      return { items: [], total: 0 };
    },
    async getCampaign() {
      calls.push("get");
      return { id: "campaign-1" };
    },
    async updateCampaign() {
      calls.push("update");
      return { id: "campaign-1" };
    },
    async deleteCampaign() {
      calls.push("delete");
    },
    async cloneCampaign() {
      calls.push("clone");
      return { id: "campaign-2" };
    },
    async previewCampaign() {
      calls.push("preview");
      return { campaignId: "campaign-1", preview: [], title: "t", message: "m", url: "https://example.com", imageUrl: null, iconUrl: null };
    },
    async scheduleCampaign() {
      calls.push("schedule");
      return { id: "campaign-1" };
    },
  };

  const controller = new CampaignsController(service as never);

  const created = await controller.createCampaign({
    siteId: "site-1",
    name: "Launch Campaign",
    channel: "web",
    type: "instant",
    title: "Big Sale",
    message: "Shop now",
    url: "https://example.com",
  });

  assert.equal(created.success, true);
  assert.deepEqual(calls, ["create"]);
});
