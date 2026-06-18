import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPushProcessor } from "../src/browser-push.processor";
import type { BrowserPushJobPayload } from "../src/browser-push.types";

test("browser push processor marks expired subscribers", async () => {
  const events: Array<{ status: string; subscriberId: string }> = [];
  const expired: string[] = [];
  let lastSubscriberId: string | null = null;
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
    async createPendingDeliveryEvent(input: { subscriberId: string | null }) {
      if (!input.subscriberId) {
        return "delivery-1";
      }

      lastSubscriberId = input.subscriberId;
      events.push({ status: "pending", subscriberId: input.subscriberId });
      return "delivery-1";
    },
    async markDeliveryEventSent() {
      return undefined;
    },
    async markDeliveryEventFailed(_id: string, input: { status: string }) {
      if (!lastSubscriberId) {
        return;
      }

      events.push({ status: input.status, subscriberId: lastSubscriberId });
    },
    async markSubscriberExpired(subscriberId: string) {
      expired.push(subscriberId);
    },
  };

  const fakeSender = {
    configure() {
      return undefined;
    },
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
  assert.deepEqual(events, [
    { status: "pending", subscriberId: "subscriber-1" },
    { status: "expired", subscriberId: "subscriber-1" },
  ]);
});

test("browser push processor retries transient relay failures", async () => {
  const events: Array<{ status: string; subscriberId: string }> = [];
  const sleeps: number[] = [];
  let attempts = 0;

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
    async createPendingDeliveryEvent(input: { subscriberId: string | null }) {
      if (!input.subscriberId) {
        return "delivery-1";
      }

      events.push({ status: "pending", subscriberId: input.subscriberId });
      return "delivery-1";
    },
    async markDeliveryEventSent() {
      events.push({ status: "sent", subscriberId: "subscriber-1" });
    },
    async markDeliveryEventFailed(_id: string, input: { status: string }) {
      events.push({ status: input.status, subscriberId: "subscriber-1" });
    },
    async markSubscriberExpired() {
      return undefined;
    },
  };

  const fakeSender = {
    configure() {
      return undefined;
    },
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
  assert.deepEqual(events, [
    { status: "pending", subscriberId: "subscriber-1" },
    { status: "sent", subscriberId: "subscriber-1" },
  ]);
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
    async createPendingDeliveryEvent() {
      return "delivery-1";
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
    async markCampaignSent() {
      return undefined;
    },
    async markCampaignFailed() {
      return undefined;
    },
  };

  const fakeSender = {
    configure() {
      return undefined;
    },
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
    async createPendingDeliveryEvent() {
      return "delivery-42";
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
    configure() {
      return undefined;
    },
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
