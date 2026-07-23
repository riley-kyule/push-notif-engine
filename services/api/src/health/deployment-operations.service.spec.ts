import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DeploymentOperationsService, getDeploymentCommand, getDeploymentMode } from "./deployment-operations.service";

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

test("Docker mode queues an allowlisted host-agent request instead of executing Docker in the API", async () => {
  const requestDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "epe-deployment-request-"));
  const previousMode = process.env.EPE_DEPLOYMENT_MODE;
  const previousDirectory = process.env.EPE_DEPLOYMENT_REQUEST_DIR;
  process.env.EPE_DEPLOYMENT_MODE = "docker";
  process.env.EPE_DEPLOYMENT_REQUEST_DIR = requestDirectory;

  try {
    assert.equal(getDeploymentMode(), "docker");
    const result = await new DeploymentOperationsService().run("minor-update");
    const request = JSON.parse(await fs.readFile(path.join(requestDirectory, "request.json"), "utf8")) as {
      requestId: string;
      action: string;
    };

    assert.equal(result.mode, "docker");
    assert.equal(result.accepted, true);
    assert.equal(result.requestId, request.requestId);
    assert.equal(request.action, "minor-update");
  } finally {
    if (previousMode === undefined) delete process.env.EPE_DEPLOYMENT_MODE;
    else process.env.EPE_DEPLOYMENT_MODE = previousMode;
    if (previousDirectory === undefined) delete process.env.EPE_DEPLOYMENT_REQUEST_DIR;
    else process.env.EPE_DEPLOYMENT_REQUEST_DIR = previousDirectory;
    await fs.rm(requestDirectory, { recursive: true, force: true });
  }
});
