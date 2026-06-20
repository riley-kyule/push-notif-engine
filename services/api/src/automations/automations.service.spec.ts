import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAutomationsRepository } from "./in-memory-automations.repository";
import { AutomationsService } from "./automations.service";

function createService(overrides: { dispatchCalls?: unknown[] } = {}) {
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
  };
  const dispatchCalls = overrides.dispatchCalls ?? [];
  const browserPushService = {
    async dispatch(input: unknown) {
      dispatchCalls.push(input);
      return { jobId: "job-1", queued: true as const };
    },
  };
  const repository = new InMemoryAutomationsRepository();
  const service = new AutomationsService(sitesService as never, browserPushService as never, repository as never);

  return { service, repository, dispatchCalls };
}

test("automations service creates, updates, and lists automations", async () => {
  const { service } = createService();

  const created = await service.createAutomation({
    siteId: "site-1",
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  });

  assert.equal(created.status, "active");
  assert.equal(created.triggerEvent, "subscriber_registered");

  const updated = await service.updateAutomation(created.id, { status: "paused" });
  assert.equal(updated.status, "paused");

  const list = await service.listAutomations({ siteId: "site-1", limit: 20, offset: 0 });
  assert.equal(list.total, 1);
});

test("automations service dispatches a single-subscriber push for each active matching automation", async () => {
  const dispatchCalls: unknown[] = [];
  const { service } = createService({ dispatchCalls });

  await service.createAutomation({
    siteId: "site-1",
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  });

  // A paused automation must not fire.
  await service.createAutomation({
    siteId: "site-1",
    name: "Paused automation",
    triggerEvent: "subscriber_registered",
    title: "Should not send",
    message: "Should not send",
    url: "https://example.com/never",
    status: "paused",
  });

  await service.handleSubscriberRegistered({
    id: "subscriber-1",
    siteId: "site-1",
    browser: "Chrome",
    deviceType: "desktop",
    country: "US",
    language: "en",
    subscriptionEndpoint: "https://push.example.com/one",
    p256dhKey: "key",
    authKey: "auth",
    status: "active",
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(dispatchCalls.length, 1);
  assert.deepEqual(dispatchCalls[0], {
    siteId: "site-1",
    subscriberId: "subscriber-1",
    title: "Welcome!",
    body: "Thanks for subscribing",
    url: "https://example.com/welcome",
    icon: null,
    image: null,
  });
});

test("automations service skips dispatch when the subscriber has no push keys yet", async () => {
  const dispatchCalls: unknown[] = [];
  const { service } = createService({ dispatchCalls });

  await service.createAutomation({
    siteId: "site-1",
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  });

  await service.handleSubscriberRegistered({
    id: "subscriber-1",
    siteId: "site-1",
    browser: "Chrome",
    deviceType: "desktop",
    country: "US",
    language: "en",
    subscriptionEndpoint: "https://push.example.com/one",
    p256dhKey: null,
    authKey: null,
    status: "active",
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(dispatchCalls.length, 0);
});

test("automations service continues dispatching remaining automations if one dispatch fails", async () => {
  const dispatchCalls: unknown[] = [];
  const sitesService = {
    async getSite() {
      return { id: "site-1" };
    },
  };
  const browserPushService = {
    async dispatch(input: { title: string }) {
      dispatchCalls.push(input);
      if (input.title === "Should fail") {
        throw new Error("dispatch failed");
      }
      return { jobId: "job-1", queued: true as const };
    },
  };
  const repository = new InMemoryAutomationsRepository();
  const service = new AutomationsService(sitesService as never, browserPushService as never, repository as never);

  await service.createAutomation({
    siteId: "site-1",
    name: "First automation",
    triggerEvent: "subscriber_registered",
    title: "Should fail",
    message: "Should fail",
    url: "https://example.com/fail",
  });
  await service.createAutomation({
    siteId: "site-1",
    name: "Second automation",
    triggerEvent: "subscriber_registered",
    title: "Should still send",
    message: "Should still send",
    url: "https://example.com/ok",
  });

  await service.handleSubscriberRegistered({
    id: "subscriber-1",
    siteId: "site-1",
    browser: "Chrome",
    deviceType: "desktop",
    country: "US",
    language: "en",
    subscriptionEndpoint: "https://push.example.com/one",
    p256dhKey: "key",
    authKey: "auth",
    status: "active",
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(dispatchCalls.length, 2);
  assert.equal((dispatchCalls[1] as { title: string }).title, "Should still send");
});
