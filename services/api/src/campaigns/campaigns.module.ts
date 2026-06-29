import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../analytics/analytics.module";
import { AuditModule } from "../audit/audit.module";
import { BrowserPushModule } from "../browser-push/browser-push.module";
import { CampaignMediaModule } from "../campaign-media/campaign-media.module";
import { CampaignTaxonomiesModule } from "../campaign-taxonomies/campaign-taxonomies.module";
import { DatabaseModule } from "../database/database.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { SegmentsModule } from "../segments/segments.module";
import { SitesModule } from "../sites/sites.module";
import { CampaignsSchedulerService } from "./campaigns-scheduler.service";
import { CAMPAIGNS_REPOSITORY } from "./campaigns.constants";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { PostgresCampaignsRepository } from "./postgres-campaigns.repository";
import { RestApiCampaignsController } from "./rest-api-campaigns.controller";
import { RestApiSendRateLimitGuard } from "./rest-api-send-rate-limit.guard";

@Module({
  imports: [
    DatabaseModule,
    SitesModule,
    SegmentsModule,
    BrowserPushModule,
    AuditModule,
    CampaignTaxonomiesModule,
    CampaignMediaModule,
    AnalyticsModule,
    RateLimitModule,
  ],
  controllers: [CampaignsController, RestApiCampaignsController],
  providers: [
    CampaignsService,
    CampaignsSchedulerService,
    RestApiSendRateLimitGuard,
    {
      provide: CAMPAIGNS_REPOSITORY,
      useClass: PostgresCampaignsRepository,
    },
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
