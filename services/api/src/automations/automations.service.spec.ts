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
    async listSites() {
      return {
        items: [{ id: "site-1" }, { id: "site-2" }] as Array<{ id: string }>,
        total: 2,
      };
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

test("seedDefaultAutomations creates only the welcome default, and is idempotent", async () => {
  const { service } = createService();

  const created = await service.seedDefaultAutomations("site-1");
  assert.equal(created.length, 1);
  assert.deepEqual(created.map((automation) => automation.triggerEvent), ["subscriber_registered"]);
  assert.match(created.find((a) => a.triggerEvent === "subscriber_registered")?.title ?? "", /Exotic Travel/);

  const ranAgain = await service.seedDefaultAutomations("site-1");
  assert.equal(ranAgain.length, 0);

  const list = await service.listAutomations({ siteId: "site-1", limit: 20, offset: 0 });
  assert.equal(list.total, 1);
});

test("seedDefaultAutomations does not add an unsubscribe default if a welcome automation already exists", async () => {
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
  assert.equal(created.length, 0);
});

test("seedDefaultAutomations with no siteId creates global defaults", async () => {
  const { service } = createService();

  const created = await service.seedDefaultAutomations(null);
  assert.equal(created.length, 1);
  assert.deepEqual(created.map((automation) => automation.siteId), [null]);
});

test("an All Sites automation (no siteId) is active for every site without duplicating it per site", async () => {
  const { service } = createService();

  const created = await service.createAutomation({
    siteId: null,
    name: "Global welcome",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  });

  assert.equal(created.siteId, null);

  const forSiteOne = await service.listActiveByTrigger("site-1", "subscriber_registered");
  const forSiteTwo = await service.listActiveByTrigger("site-2", "subscriber_registered");
  assert.equal(forSiteOne.length, 1);
  assert.equal(forSiteTwo.length, 1);
  assert.equal(forSiteOne[0]?.id, created.id);
  assert.equal(forSiteTwo[0]?.id, created.id);
});

test("creating an All Sites automation never looks up a site", async () => {
  const sitesService = {
    async getSite() {
      throw new Error("must not validate a site for a global automation");
    },
  };
  const repository = new InMemoryAutomationsRepository();
  const service = new AutomationsService(sitesService as never, createFakeAuditService(), repository as never);

  const created = await service.createAutomation({
    siteId: null,
    name: "Global welcome",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  });

  assert.equal(created.siteId, null);
});

test("deleteAutomation succeeds even if audit logging fails", async () => {
  const sitesService = {
    async getSite() {
      return { id: "site-1", appName: "Exotic Travel", url: "https://exotic-travel.example.com" };
    },
  };
  const repository = new InMemoryAutomationsRepository();
  const auditService = {
    async log() {
      throw new Error("audit store unavailable");
    },
  };
  const service = new AutomationsService(sitesService as never, auditService as never, repository as never);

  const created = await service.createAutomation({
    siteId: "site-1",
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  });

  await assert.doesNotReject(() => service.deleteAutomation(created.id, "user-1"));
  const stillExists = await service.getAutomation(created.id).then(() => true).catch(() => false);
  assert.equal(stillExists, false);
});
