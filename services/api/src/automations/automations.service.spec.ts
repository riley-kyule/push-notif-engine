import assert from "node:assert/strict";
import test from "node:test";

import { createFakeAuditService } from "../audit/audit.service.fake";
import { InMemoryAutomationsRepository } from "./in-memory-automations.repository";
import { AutomationsService } from "./automations.service";

function createService(overrides: { dispatchCalls?: unknown[] } = {}) {
  const sitesService = {
    async getSite() {
      return { id: "site-1", appName: "Exotic Travel", url: "https://exotic-travel.example.com" };
    },
  };
  const dispatchCalls = overrides.dispatchCalls ?? [];
  const repository = new InMemoryAutomationsRepository();
  const service = new AutomationsService(sitesService as never, createFakeAuditService(), repository as never);

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

test("automations service lists active automations by trigger", async () => {
  const { service } = createService();

  await service.createAutomation({
    siteId: "site-1",
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  });

  await service.createAutomation({
    siteId: "site-1",
    name: "Paused automation",
    triggerEvent: "subscriber_registered",
    title: "Should not send",
    message: "Should not send",
    url: "https://example.com/never",
    status: "paused",
  });

  const active = await service.listActiveByTrigger("site-1", "subscriber_registered");
  assert.equal(active.length, 1);
  assert.equal(active[0]?.name, "Welcome push");
});

test("seedDefaultAutomations creates a welcome and an unsubscribe default, and is idempotent", async () => {
  const { service } = createService();

  const created = await service.seedDefaultAutomations("site-1");
  assert.equal(created.length, 2);
  assert.deepEqual(
    created.map((automation) => automation.triggerEvent).sort(),
    ["subscriber_registered", "subscriber_unsubscribed"],
  );
  assert.match(created.find((a) => a.triggerEvent === "subscriber_registered")?.title ?? "", /Exotic Travel/);

  const ranAgain = await service.seedDefaultAutomations("site-1");
  assert.equal(ranAgain.length, 0);

  const list = await service.listAutomations({ siteId: "site-1", limit: 20, offset: 0 });
  assert.equal(list.total, 2);
});

test("seedDefaultAutomations only fills in the missing trigger if one default already exists", async () => {
  const { service } = createService();

  await service.createAutomation({
    siteId: "site-1",
    name: "Existing welcome",
    triggerEvent: "subscriber_registered",
    title: "Hi",
    message: "Hi there",
    url: "https://example.com",
  });

  const created = await service.seedDefaultAutomations("site-1");
  assert.equal(created.length, 1);
  assert.equal(created[0]?.triggerEvent, "subscriber_unsubscribed");
});
