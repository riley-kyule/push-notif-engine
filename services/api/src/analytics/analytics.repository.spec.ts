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
