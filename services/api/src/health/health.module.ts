import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CampaignMediaModule } from "../campaign-media/campaign-media.module";
import { DatabaseModule } from "../database/database.module";
import { PLATFORM_HEALTH_REDIS } from "./platform-health.constants";
import { createPlatformHealthRedisClient, PlatformHealthService } from "./platform-health.service";
import { HealthController } from "./health.controller";
import { DeploymentOperationsService } from "./deployment-operations.service";

@Module({
  imports: [DatabaseModule, CampaignMediaModule, AnalyticsModule, AuditModule],
  controllers: [HealthController],
  providers: [
    PlatformHealthService,
    DeploymentOperationsService,
    {
      provide: PLATFORM_HEALTH_REDIS,
      useFactory: createPlatformHealthRedisClient,
    },
  ],
  exports: [PlatformHealthService],
})
export class HealthModule {}
