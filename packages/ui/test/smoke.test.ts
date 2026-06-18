import assert from "node:assert/strict";
import test from "node:test";

import { uiPlaceholder } from "../src/index";

test("ui placeholder exports a string", () => {
  assert.equal(uiPlaceholder(), "ui");
});
