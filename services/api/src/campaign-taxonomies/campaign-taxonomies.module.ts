import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { CAMPAIGN_TAXONOMIES_REPOSITORY } from "./campaign-taxonomies.constants";
import { CampaignTaxonomiesController } from "./campaign-taxonomies.controller";
import { CampaignTaxonomiesService } from "./campaign-taxonomies.service";
import { PostgresContentTaxonomiesRepository } from "./postgres-campaign-taxonomies.repository";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CampaignTaxonomiesController],
  providers: [
    CampaignTaxonomiesService,
    {
      provide: CAMPAIGN_TAXONOMIES_REPOSITORY,
      useClass: PostgresContentTaxonomiesRepository,
    },
  ],
  exports: [CampaignTaxonomiesService],
})
export class CampaignTaxonomiesModule {}
