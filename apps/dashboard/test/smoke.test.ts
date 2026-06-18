import assert from "node:assert/strict";
import test from "node:test";

import DashboardHome from "../app/page";

test("dashboard home component exists", () => {
  assert.equal(typeof DashboardHome, "function");
});
