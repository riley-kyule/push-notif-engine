import { Module } from "@nestjs/common";

import { AutomationsModule } from "../automations/automations.module";
import { BrowserPushModule } from "../browser-push/browser-push.module";
import { DatabaseModule } from "../database/database.module";
import { SitesModule } from "../sites/sites.module";
import { WorkflowController } from "./workflow.controller";
import { WORKFLOW_REPOSITORY, WorkflowService } from "./workflow.service";
import { PostgresWorkflowRepository } from "./postgres-workflow.repository";

@Module({
  imports: [DatabaseModule, SitesModule, AutomationsModule, BrowserPushModule],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    {
      provide: WORKFLOW_REPOSITORY,
      useClass: PostgresWorkflowRepository,
    },
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
