import assert from "node:assert/strict";
import test from "node:test";

import { getDeploymentCommand } from "./deployment-operations.service";

test("deployment command uses the minor update script", () => {
  const command = getDeploymentCommand("minor-update");

  assert.equal(command.command, "bash");
  assert.deepEqual(command.args, ["scripts/minor-update.sh"]);
  assert.equal(command.timeout, 2 * 60 * 1000);
});

test("deployment command uses the core update script", () => {
  const command = getDeploymentCommand("core-update");

  assert.equal(command.command, "bash");
  assert.deepEqual(command.args, ["scripts/deploy-update.sh"]);
  assert.equal(command.timeout, 20 * 60 * 1000);
});
