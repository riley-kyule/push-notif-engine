import { Module } from "@nestjs/common";

import { BrowserPushModule } from "../browser-push/browser-push.module";
import { DatabaseModule } from "../database/database.module";
import { SegmentsModule } from "../segments/segments.module";
import { SitesModule } from "../sites/sites.module";
import { CampaignsSchedulerService } from "./campaigns-scheduler.service";
import { CAMPAIGNS_REPOSITORY } from "./campaigns.constants";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { PostgresCampaignsRepository } from "./postgres-campaigns.repository";

@Module({
  imports: [DatabaseModule, SitesModule, SegmentsModule, BrowserPushModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignsSchedulerService,
    {
      provide: CAMPAIGNS_REPOSITORY,
      useClass: PostgresCampaignsRepository,
    },
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
