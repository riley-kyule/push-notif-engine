import assert from "node:assert/strict";
import test from "node:test";

import { PublicWorkflowController } from "./public-workflow.controller";

test("public workflow controller records a page_visit event with no auth context", async () => {
  const calls: unknown[] = [];
  const controller = new PublicWorkflowController({
    async recordEvent(input: unknown) {
      calls.push(input);
      return { id: "event-1" };
    },
  } as never);

  const result = await controller.track({
    siteId: "site-1",
    triggerEvent: "page_visit",
    payload: { url: "https://example.com/article" },
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls[0], {
    siteId: "site-1",
    subscriberId: null,
    campaignId: null,
    triggerEvent: "page_visit",
    payload: { url: "https://example.com/article" },
  });
});

test("public workflow controller records an api_event with a subscriberId", async () => {
  const calls: unknown[] = [];
  const controller = new PublicWorkflowController({
    async recordEvent(input: unknown) {
      calls.push(input);
      return { id: "event-1" };
    },
  } as never);

  await controller.track({
    siteId: "site-1",
    triggerEvent: "api_event",
    subscriberId: "subscriber-1",
    payload: { eventName: "purchase" },
  });

  assert.deepEqual(calls[0], {
    siteId: "site-1",
    subscriberId: "subscriber-1",
    campaignId: null,
    triggerEvent: "api_event",
    payload: { eventName: "purchase" },
  });
});
