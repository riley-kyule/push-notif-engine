import assert from "node:assert/strict";
import test from "node:test";

import { SubscribersController } from "./subscribers.controller";

test("subscribers controller exposes public register and unsubscribe endpoints", async () => {
  const calls: Array<{ method: string; payload: unknown }> = [];

  const controller = new SubscribersController({
    async registerSubscriber(dto: unknown) {
      calls.push({ method: "register", payload: dto });
      return { id: "subscriber-1" };
    },
    async unsubscribeSubscriber(dto: unknown) {
      calls.push({ method: "unsubscribe", payload: dto });
      return { id: "subscriber-1", status: "unsubscribed" };
    },
  } as never);

  const registered = await controller.register(
    {
      siteId: "site-1",
      browser: "Chrome",
      deviceType: "desktop",
      country: "US",
      language: "en",
      subscriptionEndpoint: "https://push.example.com/endpoint-1",
    } as never,
    { headers: { "cf-ipcountry": "KE" } },
  );

  const unsubscribed = await controller.unsubscribe({
    siteId: "site-1",
    subscriptionEndpoint: "https://push.example.com/endpoint-1",
  } as never);

  assert.equal(registered.success, true);
  assert.equal(unsubscribed.success, true);
  assert.equal(calls.length, 2);
  assert.equal((calls[0]?.payload as { siteId?: string } | undefined)?.siteId, "site-1");
  assert.equal((calls[1]?.payload as { subscriptionEndpoint?: string } | undefined)?.subscriptionEndpoint, "https://push.example.com/endpoint-1");
});
