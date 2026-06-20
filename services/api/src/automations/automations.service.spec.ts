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
  const repository = new InMemoryAutomationsRepository();
  const service = new AutomationsService(sitesService as never, repository as never);

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
