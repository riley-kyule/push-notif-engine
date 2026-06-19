import assert from "node:assert/strict";
import test from "node:test";

import { AutomationsController } from "./automations.controller";

test("automations controller returns created automation data", async () => {
  const calls: string[] = [];
  const service = {
    async createAutomation() {
      calls.push("create");
      return { id: "automation-1" };
    },
    async listAutomations() {
      calls.push("list");
      return { items: [], total: 0 };
    },
    async getAutomation() {
      calls.push("get");
      return { id: "automation-1" };
    },
    async updateAutomation() {
      calls.push("update");
      return { id: "automation-1" };
    },
    async deleteAutomation() {
      calls.push("delete");
    },
  };

  const controller = new AutomationsController(service as never);

  const created = await controller.createAutomation({
    siteId: "site-1",
    name: "Welcome push",
    triggerEvent: "subscriber_registered",
    title: "Welcome!",
    message: "Thanks for subscribing",
    url: "https://example.com/welcome",
  } as never);

  assert.equal(created.success, true);
  assert.deepEqual(calls, ["create"]);
});
