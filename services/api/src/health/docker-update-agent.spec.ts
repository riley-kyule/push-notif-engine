import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function runAgent(scriptPath: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Agent exited with ${code}: ${stderr}`));
    });
  });
}

test("Docker update agent executes only the fixed build, migration, recreation, and validation flow", async () => {
  const rootDir = path.resolve(__dirname, "../../../../");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "epe-docker-agent-"));
  const binDir = path.join(temporary, "bin");
  const requestDir = path.join(temporary, "requests");
  await fs.mkdir(binDir);
  await fs.mkdir(requestDir);

  const fakeGit = `#!/bin/sh
case "$1" in
  rev-parse) echo "1234567890abcdef1234567890abcdef12345678" ;;
  ls-remote) echo "1234567890abcdef1234567890abcdef12345678 refs/heads/main" ;;
  status) exit 0 ;;
  *) echo "git $*" ;;
esac
`;
  const fakeDocker = `#!/bin/sh
if [ "$1" = "inspect" ]; then
  echo "push-engine_push_internal"
  echo "push-engine_push_egress"
elif [ "$1" = "compose" ] && echo "$*" | grep -q "ps --format json"; then
  echo '{"Service":"push-api","State":"running","Health":"healthy","Image":"exotic-push-engine:production"}'
  echo '{"Service":"push-dashboard","State":"running","Health":"healthy","Image":"exotic-push-engine:production"}'
  echo '{"Service":"push-worker","State":"running","Health":"healthy","Image":"exotic-push-engine:production"}'
else
  echo "docker $*"
fi
`;
  await fs.writeFile(path.join(binDir, "git"), fakeGit, { mode: 0o755 });
  await fs.writeFile(path.join(binDir, "docker"), fakeDocker, { mode: 0o755 });
  await fs.writeFile(
    path.join(requestDir, "request.json"),
    JSON.stringify({ requestId: "request-1", action: "minor-update", requestedAt: new Date().toISOString() }),
  );

  try {
    await runAgent(path.join(rootDir, "scripts/docker-update-agent.mjs"), {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      EPE_REPO_DIR: rootDir,
      EPE_COMPOSE_FILE: path.join(rootDir, "infrastructure/deployment/compose.production.yaml"),
      EPE_DEPLOYMENT_REQUEST_DIR: requestDir,
      EPE_UPDATE_AGENT_ONCE: "true",
      PUSH_ENGINE_IMAGE: "exotic-push-engine:production",
    });

    const status = JSON.parse(await fs.readFile(path.join(requestDir, "status.json"), "utf8")) as {
      state: string;
      requestId: string;
      services: Array<{ name: string; status: string }>;
    };
    assert.equal(status.state, "succeeded");
    assert.equal(status.requestId, "request-1");
    assert.ok(status.services.some((service) => service.name === "push-worker" && service.status === "running"));
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
