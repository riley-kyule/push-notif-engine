import assert from "node:assert/strict";
import test from "node:test";

import { BrowserPushService } from "./browser-push.service";
import type { BrowserPushJobPayload } from "./browser-push.types";

test("browser push service enqueues a dispatch job", async () => {
  const fakeSitesService = {
    async getSite() {
      return {
        id: "site-1",
        vapidSubject: "mailto:push@example.com",
        vapidPublicKey: "public-key",
        vapidPrivateKey: "private-key",
      };
    },
  };

  const queue = {
    async add(_name: string, payload: BrowserPushJobPayload) {
      return { id: "job-1", payload };
    },
  };

  const fakeBrowserPushRepository = {};
  const fakeAuditService = { async log() { return undefined; } };

  const service = new BrowserPushService(fakeSitesService as never, fakeBrowserPushRepository as never, fakeAuditService as never, queue as never);

  const result = await service.dispatch({
    siteId: "site-1",
    title: "New article",
    body: "Read the latest update",
    url: "https://example.com/articles/1",
    icon: null,
    image: null,
  });

  assert.equal(result.queued, true);
  assert.equal(result.jobId, "job-1");
});

test("browser push service clears failed deliveries and audits the count", async () => {
  const auditCalls: Array<Record<string, unknown>> = [];
  const fakeBrowserPushRepository = {
    async clearFailedDeliveries() {
      return 109;
    },
  };
  const fakeAuditService = {
    async log(entry: Record<string, unknown>) {
      auditCalls.push(entry);
    },
  };

  const service = new BrowserPushService({} as never, fakeBrowserPushRepository as never, fakeAuditService as never, {} as never);
  const cleared = await service.clearFailedDeliveries("user-1");

  assert.equal(cleared, 109);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0]?.actorUserId, "user-1");
  assert.equal(auditCalls[0]?.action, "platform.failed_deliveries_cleared");
  assert.deepEqual(auditCalls[0]?.metadata, { cleared: 109 });
});

test("browser push service clears all delivery history and audits the count", async () => {
  const auditCalls: Array<Record<string, unknown>> = [];
  const fakeBrowserPushRepository = {
    async clearAllDeliveryHistory() {
      return 5000;
    },
  };
  const fakeAuditService = {
    async log(entry: Record<string, unknown>) {
      auditCalls.push(entry);
    },
  };

  const service = new BrowserPushService({} as never, fakeBrowserPushRepository as never, fakeAuditService as never, {} as never);
  const cleared = await service.clearAllDeliveryHistory("user-1");

  assert.equal(cleared, 5000);
  assert.equal(auditCalls[0]?.action, "platform.all_delivery_history_cleared");
  assert.deepEqual(auditCalls[0]?.metadata, { cleared: 5000 });
});
