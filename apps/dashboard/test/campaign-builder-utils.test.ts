import assert from "node:assert/strict";
import test from "node:test";

import { buildUrl, parseDateTime } from "../app/campaigns/new/campaign-builder.utils";

test("campaign builder utils normalize urls and dates", () => {
  assert.equal(buildUrl("http://127.0.0.1:3001/api/", "/campaigns"), "http://127.0.0.1:3001/api/campaigns");
  assert.equal(parseDateTime("2026-06-18T09:00"), new Date("2026-06-18T09:00").toISOString());
});
