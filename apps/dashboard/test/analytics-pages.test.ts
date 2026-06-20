import assert from "node:assert/strict";
import test from "node:test";

import AnalyticsPage from "../app/analytics/page";

test("analytics dashboard page exists", () => {
  assert.equal(typeof AnalyticsPage, "function");
});
