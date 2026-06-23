import { ForbiddenException, Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DeploymentAction = "update" | "restart";

export interface DeploymentActionResult {
  action: DeploymentAction;
  command: string;
  stdout: string;
  stderr: string;
}

function rootDirFromScript(): string {
  return path.resolve(__dirname, "../../../../");
}

export function getDeploymentCommand(action: DeploymentAction): { command: string; args: string[]; timeout: number } {
  if (action === "update") {
    return { command: "bash", args: ["scripts/deploy-update.sh"], timeout: 20 * 60 * 1000 };
  }

  return { command: "bash", args: ["scripts/pm2-restart.sh"], timeout: 60 * 1000 };
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

  async run(action: DeploymentAction): Promise<DeploymentActionResult> {
    this.assertEnabled();

    const deploymentCommand = getDeploymentCommand(action);
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
    };
  }
}
