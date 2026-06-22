import assert from "node:assert/strict";
import test from "node:test";

import { summarizeStorageHealth } from "../app/_data/storage-health";

test("storage health summary maps ok status to a live badge", () => {
  const summary = summarizeStorageHealth("ok");
  assert.equal(summary.status, "healthy");
  assert.equal(summary.label, "Storage healthy");
  assert.equal(summary.badgeClass, "active");
});

test("storage health summary maps failures to a warning badge", () => {
  const summary = summarizeStorageHealth("error");
  assert.equal(summary.status, "unhealthy");
  assert.equal(summary.label, "Storage offline");
  assert.equal(summary.badgeClass, "failed");
});

test("storage health summary maps missing status to unknown", () => {
  const summary = summarizeStorageHealth(undefined);
  assert.equal(summary.status, "unknown");
  assert.equal(summary.label, "Storage unknown");
  assert.equal(summary.badgeClass, "pending");
});
