import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAutomationsRepository } from "./in-memory-automations.repository";

test("site-scoped automation lists include global defaults alongside site-specific automations", async () => {
  const repository = new InMemoryAutomationsRepository();

  await repository.create({
    siteId: null,
    name: "Global welcome",
    triggerEvent: "subscriber_registered",
    actions: [],
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/global",
    imageUrl: null,
    iconUrl: null,
    buttons: [],
    status: "active",
  });

  await repository.create({
    siteId: "site-1",
    name: "Site welcome",
    triggerEvent: "subscriber_registered",
    actions: [],
    title: "Hello",
    message: "Hello there",
    url: "https://example.com/site",
    imageUrl: null,
    iconUrl: null,
    buttons: [],
    status: "active",
  });

  const list = await repository.list({ siteId: "site-1", limit: 20, offset: 0 });

  assert.equal(list.total, 2);
  assert.deepEqual(
    list.items.map((automation) => automation.siteId).sort((left, right) => (left ?? "").localeCompare(right ?? "")),
    [null, "site-1"],
  );
});
