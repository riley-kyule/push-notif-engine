import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { WorkflowModule } from "../workflows/workflow.module";
import { SUBSCRIBERS_REPOSITORY } from "./subscribers.constants";
import { SubscribersController } from "./subscribers.controller";
import { SubscribersService } from "./subscribers.service";
import { PostgresSubscribersRepository } from "./postgres-subscribers.repository";

@Module({
  imports: [DatabaseModule, WorkflowModule, AuditModule],
  controllers: [SubscribersController],
  providers: [
    SubscribersService,
    {
      provide: SUBSCRIBERS_REPOSITORY,
      useClass: PostgresSubscribersRepository,
    },
  ],
  exports: [SubscribersService],
})
export class SubscribersModule {}
