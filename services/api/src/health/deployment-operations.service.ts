import crypto from "node:crypto";
import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DeploymentAction = "minor-update" | "core-update";
export type DeploymentMode = "docker" | "pm2";
export type DeploymentState = "idle" | "queued" | "running" | "succeeded" | "failed" | "unavailable";

export interface DeploymentVersionInfo {
  mode: DeploymentMode;
  local: {
    commit: string | null;
    branch: string | null;
    dirty: boolean;
  };
  github: {
    commit: string | null;
    branch: string | null;
  };
  comparison: "up-to-date" | "behind" | "ahead" | "diverged" | "unknown";
  aheadBy: number | null;
  behindBy: number | null;
}

export interface DeploymentActionResult {
  action: DeploymentAction;
  mode: DeploymentMode;
  requestId: string | null;
  accepted: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface DeploymentServiceStatus {
  name: string;
  status: string;
  health: string | null;
  image: string | null;
  startedAt: string | null;
}

export interface DeploymentRuntimeStatus {
  mode: DeploymentMode;
  state: DeploymentState;
  requestId: string | null;
  action: DeploymentAction | null;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  localCommit: string | null;
  remoteCommit: string | null;
  branch: string | null;
  dirty: boolean;
  services: DeploymentServiceStatus[];
  logs: string;
}

export interface Pm2ProcessStatus {
  name: string;
  pmId: number;
  pid: number | null;
  status: string;
  uptimeMs: number | null;
  restarts: number;
  cpu: number | null;
  memoryBytes: number | null;
}

interface Pm2JlistEntry {
  name?: string;
  pm_id?: number;
  pid?: number;
  pm2_env?: {
    status?: string;
    pm_uptime?: number;
    restart_time?: number;
  };
  monit?: {
    cpu?: number;
    memory?: number;
  };
}

function rootDirFromScript(): string {
  return path.resolve(__dirname, "../../../../");
}

export function getDeploymentMode(): DeploymentMode {
  return process.env.EPE_DEPLOYMENT_MODE === "docker" ? "docker" : "pm2";
}

export function getDeploymentCommand(action: DeploymentAction): { command: string; args: string[]; timeout: number } {
  if (action === "minor-update") {
    return { command: "bash", args: ["scripts/minor-update.sh"], timeout: 2 * 60 * 1000 };
  }

  return { command: "bash", args: ["scripts/deploy-update.sh"], timeout: 20 * 60 * 1000 };
}

function emptyDockerStatus(message: string): DeploymentRuntimeStatus {
  return {
    mode: "docker",
    state: "unavailable",
    requestId: null,
    action: null,
    message,
    startedAt: null,
    finishedAt: null,
    localCommit: process.env.EPE_BUILD_COMMIT?.slice(0, 8) ?? null,
    remoteCommit: null,
    branch: "main",
    dirty: false,
    services: [],
    logs: "",
  };
}

@Injectable()
export class DeploymentOperationsService {
  private readonly rootDir = rootDirFromScript();

  private isEnabled(): boolean {
    return process.env.EPE_ENABLE_DEPLOYMENT_ACTIONS !== "false";
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException("Deployment actions are disabled");
    }
  }

  private requestDirectory(): string {
    return path.resolve(process.env.EPE_DEPLOYMENT_REQUEST_DIR ?? "/deployment");
  }

  private async execGit(args: string[]): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd: this.rootDir,
        env: {
          ...process.env,
          PATH: process.env.PATH ?? "",
        },
        maxBuffer: 2 * 1024 * 1024,
      });
      return stdout.toString().trim() || null;
    } catch {
      return null;
    }
  }

  private async readDockerStatus(): Promise<DeploymentRuntimeStatus | null> {
    try {
      const raw = await fs.readFile(path.join(this.requestDirectory(), "status.json"), "utf8");
      const parsed = JSON.parse(raw) as DeploymentRuntimeStatus;
      if (parsed.mode !== "docker" || typeof parsed.state !== "string" || !Array.isArray(parsed.services)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async getVersionInfo(): Promise<DeploymentVersionInfo> {
    this.assertEnabled();

    if (getDeploymentMode() === "docker") {
      const status = await this.readDockerStatus();
      const localCommit = status?.localCommit ?? process.env.EPE_BUILD_COMMIT?.slice(0, 8) ?? null;
      const remoteCommit = status?.remoteCommit ?? null;
      return {
        mode: "docker",
        local: {
          commit: localCommit,
          branch: status?.branch ?? "main",
          dirty: status?.dirty ?? false,
        },
        github: {
          commit: remoteCommit,
          branch: "main",
        },
        comparison: localCommit && remoteCommit
          ? (remoteCommit.startsWith(localCommit) || localCommit.startsWith(remoteCommit) ? "up-to-date" : "behind")
          : "unknown",
        aheadBy: null,
        behindBy: null,
      };
    }

    const [localCommitFull, localBranch, dirtyStatus, githubCommit] = await Promise.all([
      this.execGit(["rev-parse", "HEAD"]),
      this.execGit(["branch", "--show-current"]),
      this.execGit(["status", "--porcelain"]),
      this.execGit(["ls-remote", "origin", "refs/heads/main"]),
    ]);

    const remoteCommit = githubCommit ? githubCommit.split(/\s+/)[0] ?? null : null;
    const localCommit = localCommitFull ? localCommitFull.slice(0, 8) : null;

    let comparison: DeploymentVersionInfo["comparison"] = "unknown";
    let behindBy: number | null = null;
    let aheadBy: number | null = null;

    if (localCommitFull && remoteCommit) {
      const aheadBehind = await this.execGit(["rev-list", "--left-right", "--count", `HEAD...${remoteCommit}`]);
      if (aheadBehind) {
        const [aheadText, behindText] = aheadBehind.split(/\s+/);
        const parsedAhead = Number.parseInt(aheadText ?? "", 10);
        const parsedBehind = Number.parseInt(behindText ?? "", 10);
        aheadBy = Number.isFinite(parsedAhead) ? parsedAhead : null;
        behindBy = Number.isFinite(parsedBehind) ? parsedBehind : null;

        if (behindBy !== null && aheadBy !== null) {
          if (behindBy === 0 && aheadBy === 0) comparison = "up-to-date";
          else if (behindBy > 0 && aheadBy === 0) comparison = "behind";
          else if (behindBy === 0 && aheadBy > 0) comparison = "ahead";
          else comparison = "diverged";
        }
      }
    }

    return {
      mode: "pm2",
      local: { commit: localCommit, branch: localBranch, dirty: Boolean(dirtyStatus) },
      github: { commit: remoteCommit, branch: "main" },
      comparison,
      aheadBy,
      behindBy,
    };
  }

  async getDeploymentStatus(): Promise<DeploymentRuntimeStatus> {
    this.assertEnabled();
    if (getDeploymentMode() === "docker") {
      return (await this.readDockerStatus()) ?? emptyDockerStatus(
        "Docker update agent status is unavailable. Install and start epe-docker-updater.service on the host.",
      );
    }

    const processes = await this.getPm2Status();
    return {
      mode: "pm2",
      state: processes.length > 0 && processes.every((process) => process.status === "online") ? "succeeded" : "failed",
      requestId: null,
      action: null,
      message: "PM2 process status",
      startedAt: null,
      finishedAt: null,
      localCommit: null,
      remoteCommit: null,
      branch: null,
      dirty: false,
      services: processes.map((process) => ({
        name: process.name,
        status: process.status,
        health: null,
        image: null,
        startedAt: process.uptimeMs === null ? null : new Date(Date.now() - process.uptimeMs).toISOString(),
      })),
      logs: "",
    };
  }

  async getPm2Status(): Promise<Pm2ProcessStatus[]> {
    this.assertEnabled();

    const { stdout } = await execFileAsync("pm2", ["jlist"], {
      cwd: this.rootDir,
      env: { ...process.env, PATH: process.env.PATH ?? "" },
      maxBuffer: 5 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout) as Pm2JlistEntry[];
    const now = Date.now();

    return parsed.map((entry) => ({
      name: entry.name ?? "unknown",
      pmId: typeof entry.pm_id === "number" ? entry.pm_id : -1,
      pid: typeof entry.pid === "number" ? entry.pid : null,
      status: entry.pm2_env?.status ?? "unknown",
      uptimeMs: typeof entry.pm2_env?.pm_uptime === "number" ? Math.max(0, now - entry.pm2_env.pm_uptime) : null,
      restarts: typeof entry.pm2_env?.restart_time === "number" ? entry.pm2_env.restart_time : 0,
      cpu: typeof entry.monit?.cpu === "number" ? entry.monit.cpu : null,
      memoryBytes: typeof entry.monit?.memory === "number" ? entry.monit.memory : null,
    }));
  }

  private async enqueueDockerUpdate(action: DeploymentAction): Promise<DeploymentActionResult> {
    const requestDirectory = this.requestDirectory();
    await fs.mkdir(requestDirectory, { recursive: true });
    await fs.access(requestDirectory, fsConstants.W_OK);

    const status = await this.readDockerStatus();
    if (status?.state === "queued" || status?.state === "running") {
      throw new ConflictException(`A ${status.action ?? "deployment"} is already ${status.state}`);
    }

    const requestId = crypto.randomUUID();
    const requestPath = path.join(requestDirectory, "request.json");
    try {
      await fs.writeFile(
        requestPath,
        JSON.stringify({ requestId, action, requestedAt: new Date().toISOString() }),
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new ConflictException("A deployment request is already queued");
      }
      throw error;
    }

    return {
      action,
      mode: "docker",
      requestId,
      accepted: true,
      command: "epe-docker-updater",
      stdout: "Update request accepted by the host deployment queue.",
      stderr: "",
      exitCode: 0,
    };
  }

  async run(action: DeploymentAction): Promise<DeploymentActionResult> {
    this.assertEnabled();
    if (getDeploymentMode() === "docker") {
      return this.enqueueDockerUpdate(action);
    }

    const deploymentCommand = getDeploymentCommand(action);
    try {
      const { stdout, stderr } = await execFileAsync(deploymentCommand.command, deploymentCommand.args, {
        cwd: this.rootDir,
        env: { ...process.env, PATH: process.env.PATH ?? "" },
        timeout: deploymentCommand.timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        action,
        mode: "pm2",
        requestId: null,
        accepted: true,
        command: deploymentCommand.args.join(" "),
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
      };
    } catch (error) {
      const failure = error as {
        stdout?: string | Buffer;
        stderr?: string | Buffer;
        code?: number | null;
        message?: string;
      };

      return {
        action,
        mode: "pm2",
        requestId: null,
        accepted: false,
        command: deploymentCommand.args.join(" "),
        stdout: Buffer.isBuffer(failure.stdout) ? failure.stdout.toString() : failure.stdout ? String(failure.stdout) : "",
        stderr: Buffer.isBuffer(failure.stderr) ? failure.stderr.toString() : failure.stderr ? String(failure.stderr) : failure.message ?? "",
        exitCode: typeof failure.code === "number" ? failure.code : null,
      };
    }
  }
}
