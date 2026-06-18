import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapBrowserPushWorker } from "../src/bootstrap";

test("worker bootstrap is callable", async () => {
  assert.equal(typeof bootstrapBrowserPushWorker, "function");
});
