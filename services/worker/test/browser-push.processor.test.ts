import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPushProcessor } from "../src/browser-push.processor";
import type { BrowserPushJobPayload } from "../src/browser-push.types";

// loadBrowserPushConfig() now requires this (see config.ts) rather than
// silently falling back to a broken 127.0.0.1 default -- set it once for the
// whole file instead of duplicating it per test.
process.env.BROWSER_PUSH_ACK_BASE_URL ??= "https://api.example.com/api";

// Fake bulk-insert: assigns deterministic delivery ids in input order and records
// each call so tests can assert on what was sent.
function createPendingDeliveryEventsFake(calls: Array<{ subscriberId: string }>) {
  let counter = 0;
  return async (input: { subscribers: Array<{ subscriberId: string; endpoint: string }> }) => {
    const map = new Map<string, string>();
    for (const subscriber of input.subscribers) {
      counter += 1;
      calls.push({ subscriberId: subscriber.subscriberId });
      map.set(subscriber.subscriberId, `delivery-${counter}`);
    }
    return map;
  };
}

test("browser push processor marks expired subscribers", async () => {
  const expired: string[] = [];
  const failedEvents: Array<{ status: string }> = [];

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async listEligibleSubscribers() {
      return [
        {
          id: "subscriber-1",
          subscription_endpoint: "https://push.example.com/one",
          p256dh_key: "p256dh",
          auth_key: "auth",
        },
      ];
    },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed(_id: string, input: { status: string }) {
      failedEvents.push({ status: input.status });
    },
    async markSubscriberExpired(subscriberId: string) {
      expired.push(subscriberId);
    },
  };

  const fakeSender = {
    async send() {
      throw { statusCode: 410, message: "Gone" };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    enqueuedAt: new Date().toISOString(),
    notification: {
      title: "New article",
      body: "Read the latest update",
      url: "https://example.com/articles/1",
      icon: null,
      image: null,
    },
  };

  const result = await processor.process(job);

  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.expired, 1);
  assert.deepEqual(expired, ["subscriber-1"]);
  assert.deepEqual(failedEvents, [{ status: "expired" }]);
});

test("browser push processor passes VAPID credentials per send call, not via global mutable state", async () => {
  const capturedCredentials: Array<{ publicKey: string }> = [];

  const fakeRepository = {
    async findSiteCredentials() {
      return { id: "site-1", vapid_subject: "mailto:a@example.com", vapid_public_key: "site-A-key", vapid_private_key: "priv" };
    },
    async findEligibleSubscriberById() {
      return [{ id: "sub-1", subscription_endpoint: "https://push.example.com/1", p256dh_key: "p256dh", auth_key: "auth" }];
    },
    async findAlreadySentSubscriberIds() { return new Set<string>(); },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventSent() { return undefined; },
  };

  const fakeSender = {
    async send(_sub: unknown, _payload: unknown, creds: { vapidPublicKey: string }) {
      capturedCredentials.push({ publicKey: creds.vapidPublicKey });
      return { providerMessageId: null };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  await processor.process({ siteId: "site-1", subscriberId: "sub-1", enqueuedAt: new Date().toISOString(), notification: { title: "t", body: "b", url: "https://example.com", icon: null, image: null } }, "job-1");

  assert.equal(capturedCredentials.length, 1);
  assert.equal(capturedCredentials[0]?.publicKey, "site-A-key");
});

test("browser push processor retries network errors (no statusCode) instead of marking subscriber expired", async () => {
  let attempts = 0;
  const expiredIds: string[] = [];

  const fakeRepository = {
    async findSiteCredentials() {
      return { id: "site-1", vapid_subject: "mailto:a@example.com", vapid_public_key: "pub", vapid_private_key: "priv" };
    },
    async findEligibleSubscriberById() {
      return [{ id: "sub-1", subscription_endpoint: "https://push.example.com/1", p256dh_key: "p256dh", auth_key: "auth" }];
    },
    async findAlreadySentSubscriberIds() { return new Set<string>(); },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventFailed({ status }: { status: string }) {
      if (status === "expired") expiredIds.push("sub-1");
    },
    async markSubscriberExpired(id: string) { expiredIds.push(id); },
  };

  const fakeSender = {
    async send() {
      attempts += 1;
      throw { message: "ECONNREFUSED" }; // no statusCode = network error
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never, async () => { return; });
  await processor.process({ siteId: "site-1", subscriberId: "sub-1", enqueuedAt: new Date().toISOString(), notification: { title: "t", body: "b", url: "https://example.com", icon: null, image: null } }, "job-1");

  assert.equal(attempts, 3, "should retry 3 times for a network error");
  assert.equal(expiredIds.length, 0, "should not mark subscriber expired for a network error");
});

test("browser push processor also expires a subscriber on a 403 (push service rejected this subscription's auth)", async () => {
  const expired: string[] = [];
  const failedEvents: Array<{ status: string }> = [];

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async listEligibleSubscribers() {
      return [
        {
          id: "subscriber-1",
          subscription_endpoint: "https://push.example.com/one",
          p256dh_key: "p256dh",
          auth_key: "auth",
        },
      ];
    },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed(_id: string, input: { status: string }) {
      failedEvents.push({ status: input.status });
    },
    async markSubscriberExpired(subscriberId: string) {
      expired.push(subscriberId);
    },
  };

  const fakeSender = {
    async send() {
      throw { statusCode: 403, message: "Received unexpected response code" };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    enqueuedAt: new Date().toISOString(),
    notification: {
      title: "New article",
      body: "Read the latest update",
      url: "https://example.com/articles/1",
      icon: null,
      image: null,
    },
  };

  const result = await processor.process(job);

  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.expired, 1);
  assert.deepEqual(expired, ["subscriber-1"]);
  assert.deepEqual(failedEvents, [{ status: "expired" }]);
});

test("browser push processor retries transient relay failures", async () => {
  const sleeps: number[] = [];
  let attempts = 0;
  let sentCalls = 0;

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async listEligibleSubscribers() {
      return [
        {
          id: "subscriber-1",
          subscription_endpoint: "https://push.example.com/one",
          p256dh_key: "p256dh",
          auth_key: "auth",
        },
      ];
    },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventSent() {
      sentCalls += 1;
    },
    async markDeliveryEventFailed() {
      throw new Error("should not be called on eventual success");
    },
    async markSubscriberExpired() {
      return undefined;
    },
  };

  const fakeSender = {
    async send() {
      attempts += 1;
      if (attempts < 3) {
        throw { statusCode: 429, message: "Too Many Requests" };
      }

      return { providerMessageId: "provider-123" };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never, async (ms) => {
    sleeps.push(ms);
  });
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    enqueuedAt: new Date().toISOString(),
    notification: {
      title: "New article",
      body: "Read the latest update",
      url: "https://example.com/articles/1",
      icon: null,
      image: null,
    },
  };

  const result = await processor.process(job);

  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.expired, 0);
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [250, 500]);
  assert.equal(sentCalls, 1);
});

test("browser push processor filters eligible subscribers by the campaign's segment", async () => {
  const requestedSegmentIds: string[] = [];
  const requestedSegmentDefinitions: unknown[] = [];

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async findSegmentDefinition(segmentId: string) {
      requestedSegmentIds.push(segmentId);
      return { matchMode: "all" as const, rules: [{ field: "country" as const, operator: "is" as const, value: "Kenya" }] };
    },
    async listEligibleSubscribers(_siteId: string, segmentDefinition: unknown) {
      requestedSegmentDefinitions.push(segmentDefinition);
      return [];
    },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed() {
      return undefined;
    },
    async markSubscriberExpired() {
      return undefined;
    },
    async markCampaignSent() {
      return undefined;
    },
    async markCampaignFailed() {
      return undefined;
    },
  };

  const fakeSender = {
    async send() {
      return { providerMessageId: null };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    segmentId: "segment-1",
    enqueuedAt: new Date().toISOString(),
    notification: {
      title: "Segmented",
      body: "Targeted message",
      url: "https://example.com/articles/2",
      icon: null,
      image: null,
    },
  };

  const result = await processor.process(job);

  assert.equal(result.sent, 0);
  assert.deepEqual(requestedSegmentIds, ["segment-1"]);
  assert.deepEqual(requestedSegmentDefinitions, [
    { matchMode: "all", rules: [{ field: "country", operator: "is", value: "Kenya" }] },
  ]);
});

test("browser push processor includes a deliveryId-scoped clickUrl in the outgoing notification", async () => {
  const sentNotifications: Array<{ deliveryId?: string | null; ackUrl?: string | null; clickUrl?: string | null }> = [];

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async listEligibleSubscribers() {
      return [
        {
          id: "subscriber-1",
          subscription_endpoint: "https://push.example.com/one",
          p256dh_key: "p256dh",
          auth_key: "auth",
        },
      ];
    },
    async createPendingDeliveryEvents(input: { subscribers: Array<{ subscriberId: string }> }) {
      return new Map(input.subscribers.map((subscriber) => [subscriber.subscriberId, "delivery-42"]));
    },
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed() {
      return undefined;
    },
    async markSubscriberExpired() {
      return undefined;
    },
  };

  const fakeSender = {
    async send(_subscription: unknown, notification: { deliveryId?: string | null; ackUrl?: string | null; clickUrl?: string | null }) {
      sentNotifications.push(notification);
      return { providerMessageId: "provider-123" };
    },
  };

  process.env.BROWSER_PUSH_ACK_BASE_URL = "https://api.example.com/api";
  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    enqueuedAt: new Date().toISOString(),
    notification: {
      title: "New article",
      body: "Read the latest update",
      url: "https://example.com/articles/1",
      icon: null,
      image: null,
    },
  };

  await processor.process(job);

  assert.deepEqual(sentNotifications, [
    {
      title: "New article",
      body: "Read the latest update",
      url: "https://example.com/articles/1",
      icon: null,
      image: null,
      deliveryId: "delivery-42",
      ackUrl: "https://api.example.com/api/browser-push/deliveries/delivery-42/delivered",
      clickUrl: "https://api.example.com/api/browser-push/deliveries/delivery-42/clicked",
    },
  ]);
});

test("browser push processor sends to exactly one subscriber when subscriberId is set", async () => {
  const eligibleByIdCalls: Array<[string, string]> = [];
  const listAllCalls: number[] = [];

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async findEligibleSubscriberById(siteId: string, subscriberId: string) {
      eligibleByIdCalls.push([siteId, subscriberId]);
      return [
        {
          id: subscriberId,
          subscription_endpoint: "https://push.example.com/one",
          p256dh_key: "p256dh",
          auth_key: "auth",
        },
      ];
    },
    async listEligibleSubscribers() {
      listAllCalls.push(1);
      return [];
    },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed() {
      return undefined;
    },
    async markSubscriberExpired() {
      return undefined;
    },
  };

  const fakeSender = {
    async send() {
      return { providerMessageId: "provider-1" };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    subscriberId: "subscriber-42",
    enqueuedAt: new Date().toISOString(),
    notification: {
      title: "Welcome",
      body: "Thanks for subscribing",
      url: "https://example.com/welcome",
      icon: null,
      image: null,
    },
  };

  const result = await processor.process(job);

  assert.equal(result.sent, 1);
  assert.deepEqual(eligibleByIdCalls, [["site-1", "subscriber-42"]]);
  assert.deepEqual(listAllCalls, []);
});

test("browser push processor skips subscribers already sent to under the same job id", async () => {
  const createCalls: Array<{ subscriberId: string }> = [];
  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async listEligibleSubscribers() {
      return [
        { id: "subscriber-1", subscription_endpoint: "https://push.example.com/one", p256dh_key: "p256dh", auth_key: "auth" },
        { id: "subscriber-2", subscription_endpoint: "https://push.example.com/two", p256dh_key: "p256dh", auth_key: "auth" },
      ];
    },
    async findAlreadySentSubscriberIds(jobId: string) {
      assert.equal(jobId, "job-retry-1");
      return new Set(["subscriber-1"]);
    },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake(createCalls),
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed() {
      return undefined;
    },
    async markSubscriberExpired() {
      return undefined;
    },
  };

  const fakeSender = {
    async send() {
      return { providerMessageId: "provider-1" };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    enqueuedAt: new Date().toISOString(),
    notification: { title: "t", body: "b", url: "https://example.com", icon: null, image: null },
  };

  const result = await processor.process(job, "job-retry-1");

  assert.equal(result.sent, 1);
  assert.deepEqual(createCalls, [{ subscriberId: "subscriber-2" }]);
});

test("browser push processor sends with bounded concurrency, not sequentially", async () => {
  const subscriberCount = 50;
  process.env.BROWSER_PUSH_SEND_CONCURRENCY = "10";

  let inFlight = 0;
  let maxInFlight = 0;

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async listEligibleSubscribers() {
      return Array.from({ length: subscriberCount }, (_, index) => ({
        id: `subscriber-${index}`,
        subscription_endpoint: `https://push.example.com/${index}`,
        p256dh_key: "p256dh",
        auth_key: "auth",
      }));
    },
    createPendingDeliveryEvents: createPendingDeliveryEventsFake([]),
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed() {
      return undefined;
    },
    async markSubscriberExpired() {
      return undefined;
    },
  };

  const fakeSender = {
    async send() {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { providerMessageId: "provider-1" };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    enqueuedAt: new Date().toISOString(),
    notification: { title: "t", body: "b", url: "https://example.com", icon: null, image: null },
  };

  const result = await processor.process(job);

  delete process.env.BROWSER_PUSH_SEND_CONCURRENCY;

  assert.equal(result.sent, subscriberCount);
  assert.ok(maxInFlight > 1, "expected more than one send in flight at once");
  assert.ok(maxInFlight <= 10, `expected concurrency to stay at or below the configured limit, got ${maxInFlight}`);
});

test("browser push processor splits a large subscriber list into bounded batches instead of one giant insert", async () => {
  const subscriberCount = 12_000; // spans 3 batches at the 5,000-per-batch size
  const insertBatchSizes: number[] = [];
  let deliveryCounter = 0;

  const fakeRepository = {
    async findSiteCredentials() {
      return {
        id: "site-1",
        vapid_subject: "mailto:push@example.com",
        vapid_public_key: "public-key",
        vapid_private_key: "private-key",
      };
    },
    async listEligibleSubscribers() {
      return Array.from({ length: subscriberCount }, (_, index) => ({
        id: `subscriber-${index}`,
        subscription_endpoint: `https://push.example.com/${index}`,
        p256dh_key: "p256dh",
        auth_key: "auth",
      }));
    },
    async createPendingDeliveryEvents(input: { subscribers: Array<{ subscriberId: string }> }) {
      insertBatchSizes.push(input.subscribers.length);
      const map = new Map<string, string>();
      for (const subscriber of input.subscribers) {
        deliveryCounter += 1;
        map.set(subscriber.subscriberId, `delivery-${deliveryCounter}`);
      }
      return map;
    },
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed() {
      return undefined;
    },
    async markSubscriberExpired() {
      return undefined;
    },
  };

  const fakeSender = {
    async send() {
      return { providerMessageId: "provider-1" };
    },
  };

  const processor = new BrowserPushProcessor(fakeRepository as never, fakeSender as never);
  const job: BrowserPushJobPayload = {
    siteId: "site-1",
    enqueuedAt: new Date().toISOString(),
    notification: { title: "t", body: "b", url: "https://example.com", icon: null, image: null },
  };

  const result = await processor.process(job);

  assert.equal(result.sent, subscriberCount);
  assert.deepEqual(insertBatchSizes, [5_000, 5_000, 2_000]);
  assert.ok(
    insertBatchSizes.every((size) => size <= 5_000),
    "no single batch should exceed the configured batch size",
  );
});
