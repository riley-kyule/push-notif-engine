import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryMobileClicksRepository } from "./in-memory-mobile-clicks.repository";
import { InMemoryMobileCredentialsRepository } from "./in-memory-mobile-credentials.repository";
import { InMemoryMobileDevicesRepository } from "./in-memory-mobile-devices.repository";
import { MobilePushService } from "./mobile-push.service";
import type { MobilePushJobPayload } from "./mobile-push.types";

test("mobile push service manages credentials and devices", async () => {
  const sitesService = {
    async getSite() {
      return {
        id: "site-1",
      };
    },
  };

  const credentialsRepository = new InMemoryMobileCredentialsRepository();
  const devicesRepository = new InMemoryMobileDevicesRepository();
  const clicksRepository = new InMemoryMobileClicksRepository();
  const queue = {
    async add(_name: string, payload: MobilePushJobPayload) {
      return { id: "job-1", payload };
    },
  };

  const service = new MobilePushService(
    sitesService as never,
    credentialsRepository as never,
    devicesRepository as never,
    clicksRepository as never,
    queue as never,
  );

  const credentials = await service.upsertCredentials("site-1", {
    apnsKeyId: "key-id",
    apnsTeamId: "team-id",
    apnsBundleId: "bundle-id",
    apnsPrivateKey: "private-key",
    fcmProjectId: "project-id",
    fcmClientEmail: "service@example.com",
    fcmPrivateKey: "private-key",
  });

  assert.equal(credentials.siteId, "site-1");

  const device = await service.registerDevice({
    siteId: "site-1",
    platform: "ios",
    deviceToken: "device-token-1",
    country: "US",
    language: "en",
  });

  assert.equal(device.platform, "ios");

  const refreshed = await service.refreshDeviceToken({
    siteId: "site-1",
    platform: "ios",
    currentDeviceToken: "device-token-1",
    nextDeviceToken: "device-token-2",
  });

  assert.equal(refreshed.deviceToken, "device-token-2");

  const invalidated = await service.invalidateDevice({
    siteId: "site-1",
    platform: "ios",
    deviceToken: "device-token-2",
  });

  assert.equal(invalidated.status, "invalid");

  const dispatch = await service.dispatch({
    siteId: "site-1",
    platform: "all",
    title: "New article",
    body: "Read the update",
    url: "https://example.com",
    icon: null,
    image: null,
  });

  assert.equal(dispatch.queued, true);
  assert.equal(dispatch.jobId, "job-1");

  await service.recordClick("site-1", "ios", "device-token-2", "https://example.com");
  assert.equal(clicksRepository.events.length, 1);
});
