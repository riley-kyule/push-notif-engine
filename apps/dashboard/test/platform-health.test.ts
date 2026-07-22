import assert from "node:assert/strict";
import test from "node:test";

import { getPlatformHealthBadge, summarizePlatformHealth } from "../app/_data/platform-health";

test("platform health summary falls back cleanly when the API is unavailable", () => {
  const summary = summarizePlatformHealth(null);

  assert.equal(summary.status, "unknown");
  assert.equal(summary.score, 0);
  assert.equal(summary.components.length, 4);
});

test("platform health badge maps score bands to readable labels", () => {
  assert.equal(getPlatformHealthBadge(100).label, "Healthy");
  assert.equal(getPlatformHealthBadge(80).label, "Watch");
  assert.equal(getPlatformHealthBadge(40).label, "At risk");
  assert.equal(getPlatformHealthBadge(0).label, "Unknown");
});
