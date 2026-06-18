import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { SITES_REPOSITORY } from "./sites.constants";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";
import { PostgresSitesRepository } from "./postgres-sites.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [SitesController],
  providers: [
    SitesService,
    {
      provide: SITES_REPOSITORY,
      useClass: PostgresSitesRepository,
    },
  ],
  exports: [SitesService],
})
export class SitesModule {}
