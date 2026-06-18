import assert from "node:assert/strict";
import test from "node:test";

import { MobilePushController } from "./mobile-push.controller";

test("mobile push controller records click events", async () => {
  const calls: Array<[string, string, string, string]> = [];
  const service = {
    async recordClick(siteId: string, platform: "ios" | "android", deviceToken: string, destinationUrl: string) {
      calls.push([siteId, platform, deviceToken, destinationUrl]);
    },
  };

  const controller = new MobilePushController(service as never);

  const response = await controller.recordClick({
    siteId: "site-1",
    platform: "ios",
    deviceToken: "device-token-1",
    destinationUrl: "https://example.com",
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.data, { recorded: true });
  assert.deepEqual(calls, [["site-1", "ios", "device-token-1", "https://example.com"]]);
});
