import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { MobileClicksRepository, RecordMobileClickEventInput } from "./mobile-clicks.repository";

@Injectable()
export class PostgresMobileClicksRepository implements MobileClicksRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async recordClickEvent(input: RecordMobileClickEventInput): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO mobile_push_click_events (
        site_id, mobile_device_id, platform, device_token, destination_url
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [input.siteId, input.mobileDeviceId, input.platform, input.deviceToken, input.destinationUrl],
    );
  }
}
