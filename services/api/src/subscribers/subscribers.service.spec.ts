import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySubscribersRepository } from "./in-memory-subscribers.repository";
import { SubscribersService } from "./subscribers.service";

test("subscribers service registers and filters subscribers", async () => {
  const repository = new InMemorySubscribersRepository();
  const service = new SubscribersService(repository);

  const subscriber = await service.registerSubscriber({
    siteId: "site-1",
    browser: "Chrome",
    deviceType: "desktop",
    country: "US",
    language: "en",
    subscriptionEndpoint: "https://push.example.com/endpoint-1",
    status: "active",
  });

  assert.equal(subscriber.siteId, "site-1");
  assert.equal(subscriber.browser, "Chrome");

  const result = await service.listSubscribers({ siteId: "site-1", limit: 10, offset: 0 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, subscriber.id);
});
