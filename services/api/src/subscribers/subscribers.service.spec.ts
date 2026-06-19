import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySubscribersRepository } from "./in-memory-subscribers.repository";
import { SubscribersService } from "./subscribers.service";

test("subscribers service registers and filters subscribers", async () => {
  const repository = new InMemorySubscribersRepository();
  const automationCalls: string[] = [];
  const automationsService = {
    async handleSubscriberRegistered(subscriber: { id: string }) {
      automationCalls.push(subscriber.id);
    },
  };
  const service = new SubscribersService(repository, automationsService as never);

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
  assert.deepEqual(automationCalls, [subscriber.id]);

  const result = await service.listSubscribers({ siteId: "site-1", limit: 10, offset: 0 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, subscriber.id);
});

test("subscribers service does not re-trigger automations on a re-registration", async () => {
  const repository = new InMemorySubscribersRepository();
  const automationCalls: string[] = [];
  const automationsService = {
    async handleSubscriberRegistered(subscriber: { id: string }) {
      automationCalls.push(subscriber.id);
    },
  };
  const service = new SubscribersService(repository, automationsService as never);

  const input = {
    siteId: "site-1",
    browser: "Chrome",
    deviceType: "desktop",
    country: "US",
    language: "en",
    subscriptionEndpoint: "https://push.example.com/endpoint-2",
    status: "active" as const,
  };

  await service.registerSubscriber(input);
  await service.registerSubscriber(input);

  assert.equal(automationCalls.length, 1);
});
