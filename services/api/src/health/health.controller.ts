import { Body, Controller, Get, HttpException, HttpStatus, Inject, Post, UseGuards } from "@nestjs/common";
import { Pool } from "pg";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { DATABASE_POOL } from "../database/database.constants";
import { CAMPAIGN_MEDIA_STORAGE } from "../campaign-media/campaign-media.constants";
import type { CampaignMediaStoragePort } from "../campaign-media/campaign-media-storage.port";
import { AuditService } from "../audit/audit.service";
import { DeploymentAction, DeploymentOperationsService, type DeploymentVersionInfo, type Pm2ProcessStatus } from "./deployment-operations.service";
import { PlatformHealthService } from "./platform-health.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(CAMPAIGN_MEDIA_STORAGE) private readonly campaignMediaStorage: CampaignMediaStoragePort,
    private readonly platformHealthService: PlatformHealthService,
    private readonly deploymentOperationsService: DeploymentOperationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async getHealth(): Promise<{ success: true; data: { status: string } }> {
    try {
      await this.pool.query("SELECT 1");
    } catch {
      throw new HttpException(
        { success: false, error: { message: "Database unreachable" } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { success: true, data: { status: "ok" } };
  }

  @Get("storage")
  async getStorageHealth(): Promise<{ success: true; data: { status: string } }> {
    const healthy = await this.campaignMediaStorage.ping();
    if (!healthy) {
      throw new HttpException(
        { success: false, error: { message: "Campaign media storage unreachable" } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { success: true, data: { status: "ok" } };
  }

  @Get("platform")
  async getPlatformHealth() {
    return { success: true, data: await this.platformHealthService.getPlatformHealth() };
  }

  @Get("deployment/version")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin")
  async getDeploymentVersion(): Promise<{ success: true; data: DeploymentVersionInfo }> {
    return { success: true, data: await this.deploymentOperationsService.getVersionInfo() };
  }

  @Get("deployment/pm2-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin")
  async getPm2Status(): Promise<{ success: true; data: Pm2ProcessStatus[] }> {
    return { success: true, data: await this.deploymentOperationsService.getPm2Status() };
  }

  @Post("deployment")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin")
  async runDeploymentAction(
    @Body() body: { action?: DeploymentAction },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    success: true;
    data: { action: DeploymentAction; command: string; stdout: string; stderr: string; exitCode: number | null };
  }> {
    const action = body.action === "minor-update" ? "minor-update" : "core-update";
    const result = await this.deploymentOperationsService.run(action);

    if (result.exitCode === null || result.exitCode !== 0) {
      throw new HttpException(
        {
          success: false,
          error: {
            message: action === "minor-update" ? "Minor update failed" : "Core update failed",
            details: result.stderr || result.stdout || `Command exited with code ${result.exitCode}`,
          },
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    await this.auditService.log({
      actorUserId: user.id,
      action: action === "minor-update" ? "platform.minor_update_requested" : "platform.core_update_requested",
      targetType: "platform",
      targetId: "deployment",
      metadata: { command: result.command },
    });

    return { success: true, data: result };
  }
}
