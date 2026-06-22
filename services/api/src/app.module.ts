import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { AnalyticsModule } from "./analytics/analytics.module";
import { AutomationsModule } from "./automations/automations.module";
import { AuthModule } from "./auth/auth.module";
import { BackupModule } from "./backup/backup.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { BrowserPushModule } from "./browser-push/browser-push.module";
import { HealthModule } from "./health/health.module";
import { MobilePushModule } from "./mobile-push/mobile-push.module";
import { RateLimitModule } from "./rate-limit/rate-limit.module";
import { RateLimitGuard } from "./rate-limit/rate-limit.guard";
import { SegmentsModule } from "./segments/segments.module";
import { SitesModule } from "./sites/sites.module";
import { SubscribersModule } from "./subscribers/subscribers.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HealthModule,
    RateLimitModule,
    AuthModule,
    SitesModule,
    SubscribersModule,
    BrowserPushModule,
    MobilePushModule,
    CampaignsModule,
    SegmentsModule,
    AnalyticsModule,
    AutomationsModule,
    BackupModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: RateLimitGuard,
    },
  ],
})
export class AppModule {}
