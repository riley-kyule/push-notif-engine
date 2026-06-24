import assert from "node:assert/strict";
import test from "node:test";

import SegmentsPage from "../app/segments/page";
import AutomationsPage from "../app/automations/page";
import { formatAutomationScope } from "../app/automations/automation-manager";

test("segments and automations dashboard pages exist", () => {
  assert.equal(typeof SegmentsPage, "function");
  assert.equal(typeof AutomationsPage, "function");
});

test("inherited automations are labeled explicitly", () => {
  assert.equal(
    formatAutomationScope(null, [
      { id: "site-1", name: "Exotic Travel" } as never,
      { id: "site-2", name: "Exotic Africa" } as never,
    ]),
    "Inherited from All Sites",
  );
});
