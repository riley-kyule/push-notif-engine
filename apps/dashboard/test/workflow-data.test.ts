import assert from "node:assert/strict";
import test from "node:test";

import { getFallbackWorkflowDashboardData } from "../app/_data/workflows";

test("workflow dashboard fallback data is populated", () => {
  const data = getFallbackWorkflowDashboardData();

  assert.ok(data.feeds.length > 0);
  assert.ok(data.events.length > 0);
  assert.equal(data.feeds[0]?.status, "active");
  assert.equal(typeof data.events[0]?.triggerEvent, "string");
});
