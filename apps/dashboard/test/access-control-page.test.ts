import assert from "node:assert/strict";
import test from "node:test";

import AccessControlPage from "../app/access-control/page";

test("access control dashboard page exists", () => {
  assert.equal(typeof AccessControlPage, "function");
});
