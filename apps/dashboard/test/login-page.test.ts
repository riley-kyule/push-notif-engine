import assert from "node:assert/strict";
import test from "node:test";

import LoginPage from "../app/login/page";

test("login page exists", () => {
  assert.equal(typeof LoginPage, "function");
});
