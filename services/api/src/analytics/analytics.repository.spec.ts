import assert from "node:assert/strict";
import test from "node:test";

import { AnalyticsRepository } from "./analytics.repository";

function createFakePool() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  return { pool, calls };
}

function createRowReturningFakePool(rowsByCallIndex: unknown[][]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let callIndex = 0;
  const pool = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      const rows = rowsByCallIndex[callIndex] ?? [];
      callIndex += 1;
      return { rows };
    },
  };
  return { pool, calls };
}

test("getOverview scopes every sub-query to a site when siteId is provided", async () => {
  const { pool, calls } = createFakePool();
  const repository = new AnalyticsRepository(pool as never);

  await repository.getOverview(30, "site-1");

  assert.equal(calls.length, 5);

  const [sitesCall, subscribersCall, campaignsCall, deliveryCall, failureCall] = calls;
  assert.ok(sitesCall && subscribersCall && campaignsCall && deliveryCall && failureCall);

  assert.match(sitesCall.sql, /WHERE id = \$1/);
  assert.deepEqual(sitesCall.params, ["site-1"]);

  assert.match(subscribersCall.sql, /WHERE site_id = \$1/);
  assert.deepEqual(subscribersCall.params, ["site-1"]);

  assert.match(campaignsCall.sql, /WHERE site_id = \$1/);
  assert.deepEqual(campaignsCall.params, ["site-1"]);

  assert.match(deliveryCall.sql, /AND site_id = \$2/);
  assert.deepEqual(deliveryCall.params, [30, "site-1"]);

  assert.match(failureCall.sql, /AND site_id = \$2/);
  assert.deepEqual(failureCall.params, [30, "site-1"]);
});

test("getOverview stays cross-site when no siteId is provided", async () => {
  const { pool, calls } = createFakePool();
  const repository = new AnalyticsRepository(pool as never);

  await repository.getOverview(30);

  assert.equal(calls.length, 5);
  for (const call of calls) {
    assert.doesNotMatch(call.sql, /site_id/);
    assert.ok(!call.params.includes("site-1"));
  }

  const deliveryCall = calls[3];
  assert.ok(deliveryCall);
  assert.deepEqual(deliveryCall.params, [30]);
});

test("listFailedDeliveries filters by site, push type, and reason", async () => {
  const { pool, calls } = createFakePool();
  const repository = new AnalyticsRepository(pool as never);

  await repository.listFailedDeliveries({
    siteId: "site-1",
    pushType: "automation",
    reason: "403 Received unexpected response code",
    limit: 25,
    offset: 0,
  });

  assert.equal(calls.length, 2);
  const [itemsCall, countCall] = calls;
  assert.ok(itemsCall && countCall);

  assert.match(itemsCall.sql, /pde\.site_id = \$1/);
  assert.match(itemsCall.sql, /pde\.automation_id IS NOT NULL/);
  assert.match(itemsCall.sql, /\) = \$2/);
  assert.deepEqual(itemsCall.params, ["site-1", "403 Received unexpected response code", 25, 0]);

  assert.match(countCall.sql, /pde\.site_id = \$1/);
  assert.deepEqual(countCall.params, ["site-1", "403 Received unexpected response code"]);
});

test("listFailedDeliveries maps push type and push name from campaign/automation joins", async () => {
  const rows = [
    {
      id: "delivery-1",
      site_id: "site-1",
      site_name: "Exotic Travel",
      campaign_id: "campaign-1",
      campaign_name: "Weekend Sale",
      automation_id: null,
      automation_name: null,
      error_code: "403",
      error_message: "Received unexpected response code",
      subscriber_id: "subscriber-1",
      created_at: "2026-06-25T00:00:00.000Z",
    },
    {
      id: "delivery-2",
      site_id: "site-1",
      site_name: "Exotic Travel",
      campaign_id: null,
      campaign_name: null,
      automation_id: "automation-1",
      automation_name: "Welcome push",
      error_code: "403",
      error_message: "Received unexpected response code",
      subscriber_id: "subscriber-2",
      created_at: "2026-06-25T00:01:00.000Z",
    },
    {
      id: "delivery-3",
      site_id: "site-1",
      site_name: "Exotic Travel",
      campaign_id: null,
      campaign_name: null,
      automation_id: null,
      automation_name: null,
      error_code: null,
      error_message: null,
      subscriber_id: "subscriber-3",
      created_at: "2026-06-25T00:02:00.000Z",
    },
  ];

  const { pool } = createRowReturningFakePool([rows, [{ total: "3" }]]);
  const repository = new AnalyticsRepository(pool as never);

  const result = await repository.listFailedDeliveries({ limit: 25, offset: 0 });

  assert.equal(result.total, 3);
  assert.deepEqual(
    result.items.map((item) => ({ pushType: item.pushType, pushName: item.pushName, reason: item.reason })),
    [
      { pushType: "campaign", pushName: "Weekend Sale", reason: "403 Received unexpected response code" },
      { pushType: "automation", pushName: "Welcome push", reason: "403 Received unexpected response code" },
      { pushType: "manual", pushName: null, reason: "Unknown failure" },
    ],
  );
});

test("listFailureReasons groups and counts distinct failure reasons", async () => {
  const rows = [
    { reason: "403 Received unexpected response code", count: "109" },
    { reason: "Unknown failure", count: "3" },
  ];
  const { pool } = createRowReturningFakePool([rows]);
  const repository = new AnalyticsRepository(pool as never);

  const result = await repository.listFailureReasons();

  assert.deepEqual(result, [
    { reason: "403 Received unexpected response code", count: 109 },
    { reason: "Unknown failure", count: 3 },
  ]);
});
