import assert from "node:assert/strict";
import test from "node:test";

import { MobilePushProcessor } from "../src/mobile-push.processor";
import type { MobilePushJobPayload } from "../src/mobile-push.types";

test("mobile push processor expires invalid tokens", async () => {
  const events: Array<{ status: string; deviceToken: string }> = [];
  const expired: string[] = [];
  const fakeRepository = {
    async findCredentials() {
      return {
        id: "cred-1",
        siteId: "site-1",
        apnsKeyId: "key-id",
        apnsTeamId: "team-id",
        apnsBundleId: "bundle-id",
        apnsPrivateKey: "private-key",
        fcmProjectId: "project-id",
        fcmClientEmail: "service@example.com",
        fcmPrivateKey: "private-key",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async listEligibleDevices() {
      return [
        {
          id: "device-1",
          siteId: "site-1",
          platform: "ios",
          deviceToken: "token-1",
          country: "US",
          language: "en",
          status: "active",
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    },
    async recordDeliveryEvent(input: { status: string; deviceToken: string }) {
      events.push({ status: input.status, deviceToken: input.deviceToken });
    },
    async markDeviceExpired(deviceId: string) {
      expired.push(deviceId);
    },
  };

  const fakeSender = {
    async send() {
      throw { statusCode: 410, message: "Gone" };
    },
  };

  const processor = new MobilePushProcessor(fakeRepository as never, {
    apnsSender: fakeSender as never,
    fcmSender: fakeSender as never,
  });

  const job: MobilePushJobPayload = {
    siteId: "site-1",
    platform: "all",
    enqueuedAt: new Date().toISOString(),
    notification: {
      title: "New article",
      body: "Read the update",
      url: "https://example.com",
      icon: null,
      image: null,
    },
  };

  const result = await processor.process(job);

  assert.equal(result.expired, 1);
  assert.deepEqual(expired, ["device-1"]);
  assert.deepEqual(events, [{ status: "expired", deviceToken: "token-1" }]);
});

test("mobile push processor sends with bounded concurrency, not sequentially", async () => {
  const deviceCount = 40;
  process.env.MOBILE_PUSH_SEND_CONCURRENCY = "8";

  let inFlight = 0;
  let maxInFlight = 0;

  const fakeRepository = {
    async findCredentials() {
      return {
        id: "cred-1",
        siteId: "site-1",
        apnsKeyId: "key-id",
        apnsTeamId: "team-id",
        apnsBundleId: "bundle-id",
        apnsPrivateKey: "private-key",
        fcmProjectId: "project-id",
        fcmClientEmail: "service@example.com",
        fcmPrivateKey: "private-key",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async listEligibleDevices() {
      return Array.from({ length: deviceCount }, (_, index) => ({
        id: `device-${index}`,
        siteId: "site-1",
        platform: "android" as const,
        deviceToken: `token-${index}`,
        country: "US",
        language: "en",
        status: "active" as const,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    },
    async recordDeliveryEvent() {
      return undefined;
    },
    async markDeviceExpired() {
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

  const processor = new MobilePushProcessor(fakeRepository as never, {
    apnsSender: fakeSender as never,
    fcmSender: fakeSender as never,
  });

  const job: MobilePushJobPayload = {
    siteId: "site-1",
    platform: "all",
    enqueuedAt: new Date().toISOString(),
    notification: { title: "t", body: "b", url: "https://example.com", icon: null, image: null },
  };

  const result = await processor.process(job);

  delete process.env.MOBILE_PUSH_SEND_CONCURRENCY;

  assert.equal(result.sent, deviceCount);
  assert.ok(maxInFlight > 1, "expected more than one send in flight at once");
  assert.ok(maxInFlight <= 8, `expected concurrency to stay at or below the configured limit, got ${maxInFlight}`);
});
