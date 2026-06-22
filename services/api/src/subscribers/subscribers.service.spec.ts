import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySubscribersRepository } from "./in-memory-subscribers.repository";
import { SubscribersService } from "./subscribers.service";

test("subscribers service registers and filters subscribers", async () => {
  const repository = new InMemorySubscribersRepository();
  const automationCalls: string[] = [];
  const workflowService = {
    async handleSubscriberRegistered(subscriber: { id: string }) {
      automationCalls.push(subscriber.id);
    },
  };
  const service = new SubscribersService(repository, workflowService as never);

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
  const workflowService = {
    async handleSubscriberRegistered(subscriber: { id: string }) {
      automationCalls.push(subscriber.id);
    },
  };
  const service = new SubscribersService(repository, workflowService as never);

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

test("subscribers service falls back to the detected country, then Unknown", async () => {
  const repository = new InMemorySubscribersRepository();
  const workflowService = { async handleSubscriberRegistered() {} };
  const service = new SubscribersService(repository, workflowService as never);

  const base = {
    siteId: "site-1",
    browser: "Chrome",
    deviceType: "desktop",
    language: "en",
    status: "active" as const,
  };

  const withDetected = await service.registerSubscriber(
    { ...base, subscriptionEndpoint: "https://push.example.com/endpoint-detected" },
    "KE",
  );
  assert.equal(withDetected.country, "KE");

  const withNeither = await service.registerSubscriber({
    ...base,
    subscriptionEndpoint: "https://push.example.com/endpoint-unknown",
  });
  assert.equal(withNeither.country, "Unknown");

  const withExplicit = await service.registerSubscriber(
    { ...base, country: "ZA", subscriptionEndpoint: "https://push.example.com/endpoint-explicit" },
    "KE",
  );
  assert.equal(withExplicit.country, "ZA");
});

test("subscribers service marks subscriptions as unsubscribed", async () => {
  const repository = new InMemorySubscribersRepository();
  const workflowService = { async handleSubscriberRegistered() {} };
  const service = new SubscribersService(repository, workflowService as never);

  await service.registerSubscriber({
    siteId: "site-1",
    browser: "Chrome",
    deviceType: "desktop",
    country: "US",
    language: "en",
    subscriptionEndpoint: "https://push.example.com/endpoint-unsubscribe",
    status: "active",
  });

  const unsubscribed = await service.unsubscribeSubscriber({
    siteId: "site-1",
    subscriptionEndpoint: "https://push.example.com/endpoint-unsubscribe",
  });

  assert.equal(unsubscribed?.status, "unsubscribed");
});
