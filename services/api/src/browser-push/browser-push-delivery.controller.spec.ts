import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPushDeliveryController } from "./browser-push-delivery.controller";

test("browser push delivery controller marks events as delivered", async () => {
  const updates: string[] = [];
  const controller = new BrowserPushDeliveryController({
    async markDeliveryEventDelivered(id: string) {
      updates.push(id);
      return true;
    },
  } as never);

  const result = await controller.markDelivered("delivery-1");

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { updated: true });
  assert.deepEqual(updates, ["delivery-1"]);
});

test("browser push delivery controller marks events as clicked", async () => {
  const updates: string[] = [];
  const controller = new BrowserPushDeliveryController({
    async markDeliveryEventClicked(id: string) {
      updates.push(id);
      return true;
    },
  } as never);

  const result = await controller.markClicked("delivery-1");

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { updated: true });
  assert.deepEqual(updates, ["delivery-1"]);
});
