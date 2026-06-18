import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { SitesModule } from "../sites/sites.module";
import { SEGMENTS_REPOSITORY } from "./segments.constants";
import { SegmentsController } from "./segments.controller";
import { SegmentsService } from "./segments.service";
import { PostgresSegmentsRepository } from "./postgres-segments.repository";

@Module({
  imports: [DatabaseModule, SitesModule],
  controllers: [SegmentsController],
  providers: [
    SegmentsService,
    {
      provide: SEGMENTS_REPOSITORY,
      useClass: PostgresSegmentsRepository,
    },
  ],
  exports: [SegmentsService],
})
export class SegmentsModule {}
