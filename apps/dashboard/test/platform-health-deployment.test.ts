import assert from "node:assert/strict";
import test from "node:test";

import { DeploymentActionsPanel } from "../app/platform-health/deployment-actions-panel";
import { NativeSignInPanel } from "../app/platform-health/native-sign-in-panel";

test("platform health deployment actions panel exists", () => {
  assert.equal(typeof DeploymentActionsPanel, "function");
});

test("platform health native sign-in control exists", () => {
  assert.equal(typeof NativeSignInPanel, "function");
});
