import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCampaignsRepository } from "./in-memory-campaigns.repository";
import { CampaignsService } from "./campaigns.service";

test("campaigns service creates, clones, previews, and schedules campaigns", async () => {
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
  };
  const segmentsService = {
    async getSegment() {
      return { id: "segment-1", siteId: "site-1" };
    },
  };
  const browserPushService = {
    async dispatch() {
      return { jobId: "job-1", queued: true as const };
    },
  };
  const repository = new InMemoryCampaignsRepository();
  const service = new CampaignsService(
    sitesService as never,
    segmentsService as never,
    browserPushService as never,
    repository as never,
  );

  const created = await service.createCampaign({
    siteId: "site-1",
    name: "Launch Campaign",
    channel: "web",
    type: "instant",
    title: "Big Sale",
    message: "Shop now",
    url: "https://example.com",
    imageUrl: "https://example.com/image.png",
    iconUrl: "https://example.com/icon.png",
    buttons: [{ label: "View", url: "https://example.com/view" }],
    expirationAt: "2026-07-01T10:00:00.000Z",
    status: "draft",
  });

  assert.equal(created.name, "Launch Campaign");
  assert.equal(created.buttons.length, 1);
  assert.equal(repository.campaigns.length, 1);

  const updated = await service.updateCampaign(created.id, {
    name: "Updated Campaign",
    status: "scheduled",
  });

  assert.equal(updated.name, "Updated Campaign");
  assert.equal(updated.status, "scheduled");

  const preview = await service.previewCampaign(created.id);
  assert.equal(preview.campaignId, created.id);
  assert.equal(preview.title, "Big Sale");

  const cloned = await service.cloneCampaign(created.id, {});
  assert.equal(cloned.status, "draft");
  assert.equal(cloned.clonedFromCampaignId, created.id);
  assert.equal(cloned.name, "Updated Campaign Copy");

  const scheduled = await service.scheduleCampaign(created.id, {
    scheduledAt: "2026-07-02T10:00:00.000Z",
    timezone: "Africa/Nairobi",
    recurrenceType: "daily",
    recurrenceInterval: 1,
    recurrenceUntilAt: "2026-07-31T10:00:00.000Z",
  });

  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.timezone, "Africa/Nairobi");
  assert.equal(scheduled.recurrenceType, "daily");
  assert.equal(scheduled.scheduledAt?.toISOString(), "2026-07-02T10:00:00.000Z");
});

test("campaigns service lists campaigns with content taxonomy filters", async () => {
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
  };
  const segmentsService = {
    async getSegment() {
      return { id: "segment-1", siteId: "site-1" };
    },
  };
  const browserPushService = {
    async dispatch() {
      return { jobId: "job-1", queued: true as const };
    },
  };
  const repository = new InMemoryCampaignsRepository();
  const service = new CampaignsService(
    sitesService as never,
    segmentsService as never,
    browserPushService as never,
    repository as never,
  );

  await service.createCampaign({
    siteId: "site-1",
    name: "Launch Campaign",
    channel: "web",
    type: "instant",
    contentType: "promotion",
    title: "Big Sale",
    message: "Shop now",
    url: "https://example.com",
  });

  const campaigns = await service.listCampaigns({ contentType: "promotion", limit: 20, offset: 0 });

  assert.equal(campaigns.total, 1);
  assert.equal(campaigns.items[0]?.contentType, "promotion");
});

test("campaigns service accepts a segment that belongs to the campaign's site", async () => {
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
  };
  const segmentsService = {
    async getSegment(id: string) {
      return { id, siteId: "site-1" };
    },
  };
  const browserPushService = {
    async dispatch() {
      return { jobId: "job-1", queued: true as const };
    },
  };
  const repository = new InMemoryCampaignsRepository();
  const service = new CampaignsService(
    sitesService as never,
    segmentsService as never,
    browserPushService as never,
    repository as never,
  );

  const created = await service.createCampaign({
    siteId: "site-1",
    segmentId: "segment-1",
    name: "Segmented Campaign",
    channel: "web",
    type: "instant",
    title: "Big Sale",
    message: "Shop now",
    url: "https://example.com",
  });

  assert.equal(created.segmentId, "segment-1");
});

test("campaigns service rejects a segment that belongs to a different site", async () => {
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
  };
  const segmentsService = {
    async getSegment(id: string) {
      return { id, siteId: "site-2" };
    },
  };
  const browserPushService = {
    async dispatch() {
      return { jobId: "job-1", queued: true as const };
    },
  };
  const repository = new InMemoryCampaignsRepository();
  const service = new CampaignsService(
    sitesService as never,
    segmentsService as never,
    browserPushService as never,
    repository as never,
  );

  await assert.rejects(
    () =>
      service.createCampaign({
        siteId: "site-1",
        segmentId: "segment-1",
        name: "Mismatched Campaign",
        channel: "web",
        type: "instant",
        title: "Big Sale",
        message: "Shop now",
        url: "https://example.com",
      }),
    /Segment does not belong/,
  );
});
