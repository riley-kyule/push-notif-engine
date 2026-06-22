import { Controller, Get, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import { CAMPAIGN_MEDIA_STORAGE } from "../campaign-media/campaign-media.constants";
import type { CampaignMediaStoragePort } from "../campaign-media/campaign-media-storage.port";
import { PlatformHealthService } from "./platform-health.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(CAMPAIGN_MEDIA_STORAGE) private readonly campaignMediaStorage: CampaignMediaStoragePort,
    private readonly platformHealthService: PlatformHealthService,
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
}
