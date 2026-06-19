import { Module } from "@nestjs/common";

import { AutomationsModule } from "../automations/automations.module";
import { DatabaseModule } from "../database/database.module";
import { SUBSCRIBERS_REPOSITORY } from "./subscribers.constants";
import { SubscribersController } from "./subscribers.controller";
import { SubscribersService } from "./subscribers.service";
import { PostgresSubscribersRepository } from "./postgres-subscribers.repository";

@Module({
  imports: [DatabaseModule, AutomationsModule],
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
