import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { SitesModule } from "../sites/sites.module";
import { AUTOMATIONS_REPOSITORY } from "./automations.constants";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { PostgresAutomationsRepository } from "./postgres-automations.repository";

@Module({
  imports: [DatabaseModule, SitesModule, AuditModule],
  controllers: [AutomationsController],
  providers: [
    AutomationsService,
    {
      provide: AUTOMATIONS_REPOSITORY,
      useClass: PostgresAutomationsRepository,
    },
  ],
  exports: [AutomationsService],
})
export class AutomationsModule {}
