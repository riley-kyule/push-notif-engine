import assert from "node:assert/strict";
import test from "node:test";

import { NotificationCallbackService } from "./notification-callback.service";

test("notification callback service delivers a final campaign summary and marks it delivered", async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const pool = {
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, ...(params ? { params } : {}) });
      if (sql.includes("WITH due AS")) {
        return { rows: [{ id: "callback-1", site_id: "site-1", campaign_id: "campaign-1",
          callback_url: "https://93.184.216.34/callback", campaign_status: "sent", attempt_count: 0 }] };
      }
      return { rows: [] };
    },
  };
  const analytics = { async getCampaignStats() {
    return { pending: 0, sent: 7, delivered: 3, failed: 0, expired: 0, clicked: 1, total: 10, deliveryRate: 30, clickThroughRate: 10 };
  } };
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: String(init?.body ?? "") });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    await new NotificationCallbackService(pool as never, analytics as never).deliverDueCallbacks();
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0]!.body).notificationId, "campaign-1");
  assert.ok(queries.some((query) => query.sql.includes("status = 'delivered'")));
});

test("notification callback service schedules exponential retry after an HTTP failure", async () => {
  const updates: unknown[][] = [];
  const pool = {
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("WITH due AS")) {
        return { rows: [{ id: "callback-1", site_id: "site-1", campaign_id: "campaign-1",
          callback_url: "https://93.184.216.34/callback", campaign_status: "sent", attempt_count: 1 }] };
      }
      if (sql.includes("next_attempt_at")) updates.push(params ?? []);
      return { rows: [] };
    },
  };
  const analytics = { async getCampaignStats() { return { total: 1 }; } };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
  try {
    await new NotificationCallbackService(pool as never, analytics as never).deliverDueCallbacks();
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.[1], "retrying");
  assert.equal(updates[0]?.[2], 2);
  assert.equal(updates[0]?.[3], 60);
});
