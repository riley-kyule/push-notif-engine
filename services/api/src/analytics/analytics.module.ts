import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsRepository } from "./analytics.repository";
import { AnalyticsService } from "./analytics.service";
import { GoogleSheetsClient } from "./google-sheets.client";

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository, GoogleSheetsClient],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
