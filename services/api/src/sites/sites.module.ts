import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { SITES_REPOSITORY } from "./sites.constants";
import { SitesController } from "./sites.controller";
import { PublicSitesController } from "./public-sites.controller";
import { RestApiController } from "./rest-api.controller";
import { RestApiAuthService } from "./rest-api-auth.service";
import { RestApiAuthGuard } from "./guards/rest-api-auth.guard";
import { SitesService } from "./sites.service";
import { PostgresSitesRepository } from "./postgres-sites.repository";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [SitesController, PublicSitesController, RestApiController],
  providers: [
    SitesService,
    RestApiAuthService,
    RestApiAuthGuard,
    {
      provide: SITES_REPOSITORY,
      useClass: PostgresSitesRepository,
    },
  ],
  exports: [SitesService],
})
export class SitesModule {}
