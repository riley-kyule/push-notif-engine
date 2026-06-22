import { Module } from "@nestjs/common";

import { SitesModule } from "../sites/sites.module";
import { DatabaseModule } from "../database/database.module";
import { CAMPAIGN_MEDIA_REPOSITORY, CAMPAIGN_MEDIA_STORAGE } from "./campaign-media.constants";
import { CampaignMediaController } from "./campaign-media.controller";
import { CampaignMediaSchedulerService } from "./campaign-media-scheduler.service";
import { CampaignMediaService } from "./campaign-media.service";
import { PostgresCampaignMediaRepository } from "./postgres-campaign-media.repository";
import { S3CampaignMediaStorageService } from "./s3-campaign-media-storage.service";

@Module({
  imports: [DatabaseModule, SitesModule],
  controllers: [CampaignMediaController],
  providers: [
    CampaignMediaService,
    CampaignMediaSchedulerService,
    S3CampaignMediaStorageService,
    {
      provide: CAMPAIGN_MEDIA_REPOSITORY,
      useClass: PostgresCampaignMediaRepository,
    },
    {
      provide: CAMPAIGN_MEDIA_STORAGE,
      useExisting: S3CampaignMediaStorageService,
    },
  ],
  exports: [CampaignMediaService, CAMPAIGN_MEDIA_STORAGE],
})
export class CampaignMediaModule {}
