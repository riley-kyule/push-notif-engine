import assert from "node:assert/strict";
import test from "node:test";

import { getDeploymentCommand } from "./deployment-operations.service";

test("deployment command uses the full update script", () => {
  const command = getDeploymentCommand("update");

  assert.equal(command.command, "bash");
  assert.deepEqual(command.args, ["scripts/deploy-update.sh"]);
  assert.equal(command.timeout, 20 * 60 * 1000);
});

test("deployment command uses the restart script", () => {
  const command = getDeploymentCommand("restart");

  assert.equal(command.command, "bash");
  assert.deepEqual(command.args, ["scripts/pm2-restart.sh"]);
  assert.equal(command.timeout, 60 * 1000);
});
