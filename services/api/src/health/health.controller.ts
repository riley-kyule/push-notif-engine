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
import { DeploymentAction, DeploymentOperationsService } from "./deployment-operations.service";
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

  @Post("deployment")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin")
  async runDeploymentAction(
    @Body() body: { action?: DeploymentAction },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    success: true;
    data: { action: DeploymentAction; command: string; stdout: string; stderr: string };
  }> {
    const action = body.action === "minor-update" ? "minor-update" : "core-update";
    const result = await this.deploymentOperationsService.run(action);

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
