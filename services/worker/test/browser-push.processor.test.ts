import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPushProcessor } from "../src/browser-push.processor";
import type { BrowserPushJobPayload } from "../src/browser-push.types";

test("browser push processor marks expired subscribers", async () => {
  const events: Array<{ status: string; subscriberId: string }> = [];
  const expired: string[] = [];
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
      return undefined;
    },
    async markDeliveryEventDelivered() {
      return undefined;
    },
    async markDeliveryEventFailed(input: { status: string; subscriberId: string | null }) {
      if (!input.subscriberId) {
        return;
      }

      events.push({ status: input.status, subscriberId: input.subscriberId });
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
    async markDeliveryEventDelivered() {
      events.push({ status: "delivered", subscriberId: "subscriber-1" });
    },
    async markDeliveryEventFailed(input: { status: string; subscriberId: string | null }) {
      if (!input.subscriberId) {
        return;
      }

      events.push({ status: input.status, subscriberId: input.subscriberId });
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
    { status: "delivered", subscriberId: "subscriber-1" },
  ]);
});
