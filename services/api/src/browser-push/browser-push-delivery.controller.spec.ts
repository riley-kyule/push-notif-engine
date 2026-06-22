import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPushDeliveryController } from "./browser-push-delivery.controller";

test("browser push delivery controller marks events as delivered", async () => {
  const updates: string[] = [];
  const controller = new BrowserPushDeliveryController(
    {
      async markDeliveryEventDelivered(id: string) {
        updates.push(id);
        return true;
      },
    } as never,
    { async recordEvent() {} } as never,
  );

  const result = await controller.markDelivered("delivery-1");

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { updated: true });
  assert.deepEqual(updates, ["delivery-1"]);
});

test("browser push delivery controller marks events as clicked and fires the click trigger", async () => {
  const updates: string[] = [];
  const recordedEvents: Array<{ triggerEvent: string; siteId: string }> = [];
  const controller = new BrowserPushDeliveryController(
    {
      async markDeliveryEventClicked(id: string) {
        updates.push(id);
        return true;
      },
      async findDeliveryEventContext() {
        return { siteId: "site-1", subscriberId: "subscriber-1", campaignId: null };
      },
    } as never,
    {
      async recordEvent(input: { triggerEvent: string; siteId: string }) {
        recordedEvents.push(input);
      },
    } as never,
  );

  const result = await controller.markClicked("delivery-1");

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { updated: true });
  assert.deepEqual(updates, ["delivery-1"]);
  assert.equal(recordedEvents.length, 1);
  assert.equal(recordedEvents[0]?.triggerEvent, "click");
  assert.equal(recordedEvents[0]?.siteId, "site-1");
});

test("browser push delivery controller does not fire the click trigger on a repeat click", async () => {
  const recordedEvents: unknown[] = [];
  const controller = new BrowserPushDeliveryController(
    {
      async markDeliveryEventClicked() {
        return false;
      },
      async findDeliveryEventContext() {
        throw new Error("should not be called when click was not new");
      },
    } as never,
    {
      async recordEvent(input: unknown) {
        recordedEvents.push(input);
      },
    } as never,
  );

  const result = await controller.markClicked("delivery-1");

  assert.deepEqual(result.data, { updated: false });
  assert.deepEqual(recordedEvents, []);
});
