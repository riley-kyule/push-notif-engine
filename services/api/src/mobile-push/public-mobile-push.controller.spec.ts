import assert from "node:assert/strict";
import test from "node:test";

import { PublicMobilePushController } from "./public-mobile-push.controller";

const site = { id: "site-1", name: "Exotic News" } as never;

function createController(overrides: Partial<Record<string, (...args: never[]) => unknown>> = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    async registerDevice(...args: never[]) {
      calls.push({ method: "registerDevice", args });
      return overrides.registerDevice ? overrides.registerDevice(...args) : { id: "device-1" };
    },
    async refreshDeviceToken(...args: never[]) {
      calls.push({ method: "refreshDeviceToken", args });
      return overrides.refreshDeviceToken ? overrides.refreshDeviceToken(...args) : { id: "device-1" };
    },
    async invalidateDevice(...args: never[]) {
      calls.push({ method: "invalidateDevice", args });
      return overrides.invalidateDevice ? overrides.invalidateDevice(...args) : { id: "device-1" };
    },
    async recordClick(...args: never[]) {
      calls.push({ method: "recordClick", args });
      return overrides.recordClick ? overrides.recordClick(...args) : undefined;
    },
  };

  return { controller: new PublicMobilePushController(service as never), calls };
}

test("public mobile push controller registers a device under the authenticated site, ignoring any client-supplied siteId", async () => {
  const { controller, calls } = createController();

  await controller.register(site, { platform: "ios", deviceToken: "token-1" } as never);

  assert.deepEqual(calls, [{ method: "registerDevice", args: [{ siteId: "site-1", platform: "ios", deviceToken: "token-1" }] }]);
});

test("public mobile push controller refreshes a device token under the authenticated site", async () => {
  const { controller, calls } = createController();

  await controller.refresh(site, { platform: "android", currentDeviceToken: "old-token", nextDeviceToken: "new-token" } as never);

  assert.deepEqual(calls, [
    { method: "refreshDeviceToken", args: [{ siteId: "site-1", platform: "android", currentDeviceToken: "old-token", nextDeviceToken: "new-token" }] },
  ]);
});

test("public mobile push controller invalidates a device under the authenticated site", async () => {
  const { controller, calls } = createController();

  await controller.invalidate(site, { platform: "ios", deviceToken: "token-1" } as never);

  assert.deepEqual(calls, [{ method: "invalidateDevice", args: [{ siteId: "site-1", platform: "ios", deviceToken: "token-1" }] }]);
});

test("public mobile push controller records a click under the authenticated site", async () => {
  const { controller, calls } = createController();

  const response = await controller.recordClick(site, { platform: "ios", deviceToken: "token-1", destinationUrl: "https://example.com/a" } as never);

  assert.equal(response.success, true);
  assert.deepEqual(calls, [{ method: "recordClick", args: ["site-1", "ios", "token-1", "https://example.com/a"] }]);
});
