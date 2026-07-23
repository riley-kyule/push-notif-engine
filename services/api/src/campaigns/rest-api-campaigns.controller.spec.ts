import assert from "node:assert/strict";
import test from "node:test";

import { RestApiCampaignsController } from "./rest-api-campaigns.controller";

function createFakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    async set(key: string, value: string, ...args: unknown[]) {
      const nx = args.includes("NX");
      if (nx && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return "OK";
    },
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async del(key: string) {
      store.delete(key);
    },
  };
}

const site = {
  id: "site-1",
  name: "Exotic Africa",
  subscriberCount: 7842,
} as never;

test("sendNotification creates and sends a campaign scoped to the authenticated site", async () => {
  const calls: Array<{ name: string; arg: unknown }> = [];
  const campaignsService = {
    async createCampaign(dto: unknown) {
      calls.push({ name: "createCampaign", arg: dto });
      return { id: "campaign-1", siteId: "site-1", status: "draft" };
    },
    async sendCampaign(id: string) {
      calls.push({ name: "sendCampaign", arg: id });
      return { jobId: "job-1", queued: true as const };
    },
  };
  const redis = createFakeRedis();
  const controller = new RestApiCampaignsController(campaignsService as never, {} as never, redis as never, {} as never);

  const response = await controller.sendNotification(
    site,
    { title: "Flash sale", body: "20% off tonight", url: "https://example.com/sale" },
    undefined,
  );

  assert.equal(response.success, true);
  assert.equal(response.data.notificationId, "campaign-1");
  assert.equal(response.data.jobId, "job-1");
  assert.deepEqual(
    calls.map((call) => call.name),
    ["createCampaign", "sendCampaign"],
  );
  assert.equal((calls[0]?.arg as { siteId: string }).siteId, "site-1");
});

test("sendNotification registers a durable CRM callback when callbackUrl is supplied", async () => {
  const registrations: Array<{ siteId: string; campaignId: string; callbackUrl: string }> = [];
  const campaignsService = {
    async createCampaign() { return { id: "campaign-1", siteId: "site-1", status: "draft" }; },
    async sendCampaign() { return { jobId: "job-1", queued: true as const }; },
  };
  const callbacks = {
    async register(siteId: string, campaignId: string, callbackUrl: string) {
      registrations.push({ siteId, campaignId, callbackUrl });
    },
  };
  const controller = new RestApiCampaignsController(campaignsService as never, {} as never, createFakeRedis() as never, callbacks as never);

  await controller.sendNotification(site, {
    title: "Flash sale", body: "20% off tonight", url: "https://example.com/sale",
    callbackUrl: "https://crm.example.com/hooks/push",
  });

  assert.deepEqual(registrations, [{ siteId: "site-1", campaignId: "campaign-1", callbackUrl: "https://crm.example.com/hooks/push" }]);
});

test("sendNotification replays the cached result for a repeated idempotency key instead of sending twice", async () => {
  let sendCount = 0;
  const campaignsService = {
    async createCampaign() {
      sendCount += 1;
      return { id: `campaign-${sendCount}`, siteId: "site-1", status: "draft" };
    },
    async sendCampaign(id: string) {
      return { jobId: `job-${id}`, queued: true as const };
    },
  };
  const redis = createFakeRedis();
  const controller = new RestApiCampaignsController(campaignsService as never, {} as never, redis as never, {} as never);
  const dto = { title: "Flash sale", body: "20% off tonight", url: "https://example.com/sale" };

  const first = await controller.sendNotification(site, dto, "key-123");
  const second = await controller.sendNotification(site, dto, "key-123");

  assert.equal(sendCount, 1, "the underlying campaign should only be created once");
  assert.deepEqual(second.data, first.data);
});

test("sendNotification frees the idempotency key on failure so a retry can succeed", async () => {
  let attempt = 0;
  const campaignsService = {
    async createCampaign() {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("transient failure");
      }
      return { id: "campaign-2", siteId: "site-1", status: "draft" };
    },
    async sendCampaign(id: string) {
      return { jobId: `job-${id}`, queued: true as const };
    },
  };
  const redis = createFakeRedis();
  const controller = new RestApiCampaignsController(campaignsService as never, {} as never, redis as never, {} as never);
  const dto = { title: "Flash sale", body: "20% off tonight", url: "https://example.com/sale" };

  await assert.rejects(() => controller.sendNotification(site, dto, "key-456"));
  const retried = await controller.sendNotification(site, dto, "key-456");

  assert.equal(attempt, 2);
  assert.equal(retried.data.notificationId, "campaign-2");
});

test("getNotificationStatus returns delivery stats for a campaign belonging to the authenticated site", async () => {
  const campaignsService = {
    async getCampaign(id: string) {
      return { id, siteId: "site-1", status: "sending" };
    },
  };
  const analyticsService = {
    async getCampaignStats() {
      return { pending: 1, sent: 2, delivered: 3, failed: 0, expired: 0, clicked: 1, total: 6, deliveryRate: 50, clickThroughRate: 20 };
    },
  };
  const controller = new RestApiCampaignsController(campaignsService as never, analyticsService as never, {} as never, {} as never);

  const response = await controller.getNotificationStatus(site, "campaign-1");

  assert.equal(response.data.notificationId, "campaign-1");
  assert.equal(response.data.status, "sending");
  assert.equal(response.data.delivered, 3);
});

test("getNotificationStatus 404s instead of leaking stats for a campaign on a different site", async () => {
  const campaignsService = {
    async getCampaign(id: string) {
      return { id, siteId: "some-other-site", status: "sent" };
    },
  };
  const analyticsService = {
    async getCampaignStats() {
      throw new Error("must not be called for a cross-site campaign");
    },
  };
  const controller = new RestApiCampaignsController(campaignsService as never, analyticsService as never, {} as never, {} as never);

  await assert.rejects(
    () => controller.getNotificationStatus(site, "campaign-owned-by-another-site"),
    (error: unknown) => error instanceof Error && error.constructor.name === "NotFoundException",
  );
});

test("getSubscriberCount returns the authenticated site's subscriber count", async () => {
  const controller = new RestApiCampaignsController({} as never, {} as never, {} as never, {} as never);

  const response = await controller.getSubscriberCount(site);

  assert.deepEqual(response, { success: true, data: { subscriberCount: 7842 } });
});
