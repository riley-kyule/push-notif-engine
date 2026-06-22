import assert from "node:assert/strict";
import test from "node:test";

import SegmentsPage from "../app/segments/page";
import AutomationsPage from "../app/automations/page";

test("segments and automations dashboard pages exist", () => {
  assert.equal(typeof SegmentsPage, "function");
  assert.equal(typeof AutomationsPage, "function");
});
