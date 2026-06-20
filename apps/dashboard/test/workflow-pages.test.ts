import assert from "node:assert/strict";
import test from "node:test";

import WorkflowPage from "../app/workflow/page";
import { WorkflowManager } from "../app/workflow/workflow-manager";

test("workflow dashboard pages exist", () => {
  assert.equal(typeof WorkflowPage, "function");
  assert.equal(typeof WorkflowManager, "function");
});
