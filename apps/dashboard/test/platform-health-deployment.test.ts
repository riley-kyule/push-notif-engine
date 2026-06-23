import assert from "node:assert/strict";
import test from "node:test";

import { DeploymentActionsPanel } from "../app/platform-health/deployment-actions-panel";

test("platform health deployment actions panel exists", () => {
  assert.equal(typeof DeploymentActionsPanel, "function");
});
