import { ForbiddenException, Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DeploymentAction = "minor-update" | "core-update";

export interface DeploymentVersionInfo {
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
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
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

export function getDeploymentCommand(action: DeploymentAction): { command: string; args: string[]; timeout: number } {
  if (action === "minor-update") {
    return { command: "bash", args: ["scripts/minor-update.sh"], timeout: 2 * 60 * 1000 };
  }

  return { command: "bash", args: ["scripts/deploy-update.sh"], timeout: 20 * 60 * 1000 };
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

  async getVersionInfo(): Promise<DeploymentVersionInfo> {
    this.assertEnabled();

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
          if (behindBy === 0 && aheadBy === 0) {
            comparison = "up-to-date";
          } else if (behindBy > 0 && aheadBy === 0) {
            comparison = "behind";
          } else if (behindBy === 0 && aheadBy > 0) {
            comparison = "ahead";
          } else {
            comparison = "diverged";
          }
        }
      }
    }

    return {
      local: {
        commit: localCommit,
        branch: localBranch,
        dirty: Boolean(dirtyStatus),
      },
      github: {
        commit: remoteCommit,
        branch: "main",
      },
      comparison,
      aheadBy,
      behindBy,
    };
  }

  // `pm2 jlist` gives the same data `pm2 status` prints, as parseable JSON --
  // used by the deployment panel to confirm epe-api/epe-worker/epe-dashboard
  // actually came back up after the restart scripts/pm2-restart.sh schedules
  // (deliberately delayed a few seconds past this request's own response, so
  // pm2 status immediately after a deploy action can't reflect the *new*
  // processes yet -- the caller is expected to poll this a few seconds later).
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

  async run(action: DeploymentAction): Promise<DeploymentActionResult> {
    this.assertEnabled();

    const deploymentCommand = getDeploymentCommand(action);
    try {
      const { stdout, stderr } = await execFileAsync(deploymentCommand.command, deploymentCommand.args, {
        cwd: this.rootDir,
        env: {
          ...process.env,
          PATH: process.env.PATH ?? "",
        },
        timeout: deploymentCommand.timeout,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        action,
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
        command: deploymentCommand.args.join(" "),
        stdout: Buffer.isBuffer(failure.stdout) ? failure.stdout.toString() : failure.stdout ? String(failure.stdout) : "",
        stderr: Buffer.isBuffer(failure.stderr) ? failure.stderr.toString() : failure.stderr ? String(failure.stderr) : failure.message ?? "",
        exitCode: typeof failure.code === "number" ? failure.code : null,
      };
    }
  }
}
