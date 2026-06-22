import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { CampaignMediaModule } from "../campaign-media/campaign-media.module";
import { DatabaseModule } from "../database/database.module";
import { PLATFORM_HEALTH_REDIS } from "./platform-health.constants";
import { createPlatformHealthRedisClient, PlatformHealthService } from "./platform-health.service";
import { HealthController } from "./health.controller";

@Module({
  imports: [DatabaseModule, CampaignMediaModule, AnalyticsModule],
  controllers: [HealthController],
  providers: [
    PlatformHealthService,
    {
      provide: PLATFORM_HEALTH_REDIS,
      useFactory: createPlatformHealthRedisClient,
    },
  ],
  exports: [PlatformHealthService],
})
export class HealthModule {}
