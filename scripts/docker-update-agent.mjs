#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const repoDir = path.resolve(process.env.EPE_REPO_DIR ?? process.cwd());
const composeFiles = process.env.EPE_COMPOSE_FILES
  ?? process.env.EPE_COMPOSE_FILE
  ?? path.join(repoDir, "compose.yaml");
const composeEnvironment = { COMPOSE_FILE: composeFiles };
const requestDir = path.resolve(process.env.EPE_DEPLOYMENT_REQUEST_DIR ?? "/srv/exotic/run/push-engine");
const image = process.env.PUSH_ENGINE_IMAGE ?? "exotic-push-engine:production";
const branch = process.env.EPE_DEPLOY_BRANCH ?? "main";
const requestPath = path.join(requestDir, "request.json");
const statusPath = path.join(requestDir, "status.json");
const pollMs = 2_000;
const maxLogs = 40_000;
const runOnce = process.env.EPE_UPDATE_AGENT_ONCE === "true";
let currentStatus = null;
let stopping = false;
let statusWriteChain = Promise.resolve();

function now() {
  return new Date().toISOString();
}

function boundedLogs(value) {
  return value.length > maxLogs ? value.slice(-maxLogs) : value;
}

function writeStatus(patch) {
  currentStatus = {
    mode: "docker",
    state: "idle",
    requestId: null,
    action: null,
    message: "Docker update agent is ready.",
    startedAt: null,
    finishedAt: null,
    localCommit: null,
    remoteCommit: null,
    branch,
    dirty: false,
    services: [],
    logs: "",
    ...currentStatus,
    ...patch,
  };
  const serialized = JSON.stringify(currentStatus);
  statusWriteChain = statusWriteChain.then(async () => {
    const temporary = `${statusPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, serialized, { mode: 0o644 });
    await fs.rename(temporary, statusPath);
  });
  return statusWriteChain;
}

async function run(command, args, options = {}) {
  const output = [];
  await new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoDir,
      env: { ...process.env, PUSH_ENGINE_IMAGE: image, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout = setTimeout(() => {
      if (!settled) child.kill("SIGTERM");
    }, options.timeoutMs ?? 30 * 60 * 1000);
    const capture = (chunk) => {
      const text = chunk.toString();
      output.push(text);
      void writeStatus({ logs: boundedLogs(`${currentStatus?.logs ?? ""}${text}`) });
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.once("error", (error) => {
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal ?? "unknown status"}`));
    });
  });
  return output.join("").trim();
}

async function capture(command, args, extraEnvironment = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: repoDir,
      env: { ...process.env, PUSH_ENGINE_IMAGE: image, ...extraEnvironment },
      stdio: ["ignore", "pipe", "ignore"],
    });
    const timeout = setTimeout(() => {
      if (!settled) child.kill("SIGTERM");
    }, 15_000);
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.once("error", () => {
      settled = true;
      clearTimeout(timeout);
      resolve("");
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(code === 0 ? stdout.trim() : "");
    });
  });
}

async function gitMetadata() {
  const [localFull, remoteLine, dirtyText] = await Promise.all([
    capture("git", ["rev-parse", "HEAD"]),
    capture("git", ["ls-remote", "origin", `refs/heads/${branch}`]),
    capture("git", ["status", "--porcelain", "--untracked-files=no"]),
  ]);
  return {
    localCommit: localFull ? localFull.slice(0, 8) : null,
    remoteCommit: remoteLine ? remoteLine.split(/\s+/)[0]?.slice(0, 8) ?? null : null,
    dirty: Boolean(dirtyText),
  };
}

async function serviceStatuses() {
  const raw = await capture("docker", ["compose", "ps", "--format", "json"], composeEnvironment);
  if (!raw) return [];
  try {
    const parsed = raw.startsWith("[")
      ? JSON.parse(raw)
      : raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    return parsed.map((service) => ({
      name: String(service.Service ?? service.Name ?? "unknown"),
      status: String(service.State ?? service.Status ?? "unknown"),
      health: service.Health ? String(service.Health) : null,
      image: service.Image ? String(service.Image) : null,
      startedAt: service.CreatedAt ? String(service.CreatedAt) : null,
    }));
  } catch {
    return [];
  }
}

async function updateStep(message) {
  await writeStatus({ message, services: await serviceStatuses() });
}

async function processRequest(request) {
  const startedAt = now();
  await writeStatus({
    state: "running",
    requestId: request.requestId,
    action: request.action,
    message: "Checking the host checkout...",
    startedAt,
    finishedAt: null,
    logs: "",
  });

  try {
    const dirty = await capture("git", ["status", "--porcelain", "--untracked-files=no"]);
    if (dirty) {
      throw new Error("Refusing deployment because tracked files on the host have uncommitted changes");
    }

    await updateStep("Fetching the latest source...");
    await run("git", ["fetch", "origin", branch]);
    await run("git", ["merge", "--ff-only", `origin/${branch}`]);
    const commit = await capture("git", ["rev-parse", "HEAD"]);

    if (request.action === "core-update") {
      await updateStep("Refreshing PostgreSQL and Redis base images...");
      await run("docker", ["compose", "pull", "push-postgres", "push-redis"], { env: composeEnvironment });
    }

    await updateStep(request.action === "core-update" ? "Building a clean production image..." : "Building the production image...");
    const buildArgs = ["build"];
    if (request.action === "core-update") buildArgs.push("--no-cache", "--pull");
    buildArgs.push(
      "--build-arg",
      `EPE_BUILD_COMMIT=${commit}`,
      "-f",
      path.join(repoDir, "infrastructure/deployment/Dockerfile"),
      "-t",
      image,
      ".",
    );
    await run("docker", buildArgs);

    await updateStep("Validating Docker Compose configuration...");
    await run("docker", ["compose", "config", "-q"], { env: composeEnvironment });

    await updateStep("Applying database migrations...");
    await run("docker", ["compose", "run", "--rm", "--no-deps", "push-migrate"], { env: composeEnvironment });

    await updateStep("Recreating API, dashboard, and worker containers...");
    await run("docker", [
      "compose", "up", "-d", "--force-recreate", "--no-deps",
      "push-api", "push-dashboard", "push-worker",
    ], { env: composeEnvironment });

    await updateStep("Running post-deployment validation...");
    await run(path.join(repoDir, "scripts/validate-docker-deployment.sh"), [], { env: composeEnvironment });

    const metadata = await gitMetadata();
    await writeStatus({
      state: "succeeded",
      message: "Docker update completed and all deployment checks passed.",
      finishedAt: now(),
      ...metadata,
      services: await serviceStatuses(),
    });
  } catch (error) {
    const metadata = await gitMetadata();
    const message = error instanceof Error ? error.message : "Unknown Docker update failure";
    await writeStatus({
      state: "failed",
      message,
      finishedAt: now(),
      ...metadata,
      services: await serviceStatuses(),
      logs: boundedLogs(`${currentStatus?.logs ?? ""}\n${message}`),
    });
  }
}

async function initialize() {
  await fs.mkdir(requestDir, { recursive: true });
  try {
    currentStatus = JSON.parse(await fs.readFile(statusPath, "utf8"));
  } catch {
    currentStatus = null;
  }
  const metadata = await gitMetadata();
  await writeStatus({
    ...(currentStatus?.state === "running"
      ? { state: "failed", message: "The previous updater process stopped before completing.", finishedAt: now() }
      : {}),
    ...metadata,
    services: await serviceStatuses(),
  });
}

async function loop() {
  await initialize();
  let lastRefresh = 0;
  while (!stopping) {
    try {
      const processingPath = path.join(requestDir, `processing-${crypto.randomUUID()}.json`);
      await fs.rename(requestPath, processingPath);
      try {
        const request = JSON.parse(await fs.readFile(processingPath, "utf8"));
        if (
          typeof request.requestId !== "string" ||
          (request.action !== "minor-update" && request.action !== "core-update")
        ) {
          throw new Error("Malformed deployment request");
        }
        await processRequest(request);
      } finally {
        await fs.rm(processingPath, { force: true });
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        await writeStatus({
          state: "failed",
          message: error instanceof Error ? error.message : "Unable to process deployment request",
          finishedAt: now(),
        });
      }
    }

    if (Date.now() - lastRefresh > 60_000 && currentStatus?.state !== "running") {
      const metadata = await gitMetadata();
      await writeStatus({ ...metadata, services: await serviceStatuses() });
      lastRefresh = Date.now();
    }
    if (runOnce) break;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });

loop().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
