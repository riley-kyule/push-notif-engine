import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { CampaignMediaRepository, CreateCampaignMediaInput } from "./campaign-media.repository";
import type { CampaignMediaKind, CampaignMediaRecord } from "./campaign-media.types";

const MAX_GALLERY_RESULTS = 60;

interface DbCampaignMediaRow {
  id: string;
  site_id: string;
  campaign_id: string | null;
  kind: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  public_url: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresCampaignMediaRepository implements CampaignMediaRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateCampaignMediaInput): Promise<CampaignMediaRecord> {
    const { rows } = await this.pool.query<DbCampaignMediaRow>(
      `
      INSERT INTO campaign_media_assets (
        id, site_id, campaign_id, kind, original_name, mime_type, size_bytes, storage_path, public_url
      )
      VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        input.id ?? null,
        input.siteId,
        input.campaignId,
        input.kind,
        input.originalName,
        input.mimeType,
        input.sizeBytes,
        input.storagePath,
        input.publicUrl,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create campaign media asset");
    }

    return this.mapRow(row);
  }

  async findById(id: string): Promise<CampaignMediaRecord | null> {
    const { rows } = await this.pool.query<DbCampaignMediaRow>(
      `
      SELECT *
      FROM campaign_media_assets
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async listByCampaignId(campaignId: string): Promise<CampaignMediaRecord[]> {
    const { rows } = await this.pool.query<DbCampaignMediaRow>(
      `
      SELECT *
      FROM campaign_media_assets
      WHERE campaign_id = $1
      ORDER BY created_at ASC
      `,
      [campaignId],
    );

    return rows.map((row) => this.mapRow(row));
  }

  async listBySiteId(siteId: string, kind?: CampaignMediaKind): Promise<CampaignMediaRecord[]> {
    const params: Array<string | number> = [siteId];
    let kindClause = "";
    if (kind) {
      params.push(kind);
      kindClause = `AND kind = $${params.length}`;
    }
    params.push(MAX_GALLERY_RESULTS);

    const { rows } = await this.pool.query<DbCampaignMediaRow>(
      `
      SELECT *
      FROM campaign_media_assets
      WHERE site_id = $1
      ${kindClause}
      ORDER BY created_at DESC
      LIMIT $${params.length}
      `,
      params,
    );

    return rows.map((row) => this.mapRow(row));
  }

  async attachToCampaign(assetId: string, campaignId: string): Promise<CampaignMediaRecord | null> {
    const { rows } = await this.pool.query<DbCampaignMediaRow>(
      `
      UPDATE campaign_media_assets
      SET campaign_id = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [assetId, campaignId],
    );

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.pool.query(
      `
      DELETE FROM campaign_media_assets
      WHERE id = ANY($1::uuid[])
      `,
      [ids],
    );

    return result.rowCount ?? 0;
  }

  async listCleanupCandidates(asOf: Date): Promise<CampaignMediaRecord[]> {
    const { rows } = await this.pool.query<DbCampaignMediaRow>(
      `
      WITH latest_delivery AS (
        SELECT campaign_id, MAX(delivered_at) AS delivered_at
        FROM push_delivery_events
        WHERE campaign_id IS NOT NULL
          AND delivered_at IS NOT NULL
        GROUP BY campaign_id
      )
      SELECT a.*
      FROM campaign_media_assets a
      INNER JOIN campaigns c ON c.id = a.campaign_id
      INNER JOIN latest_delivery d ON d.campaign_id = c.id
      WHERE d.delivered_at <= $1 - INTERVAL '3 days'
      ORDER BY d.delivered_at ASC, a.created_at ASC
      `,
      [asOf],
    );

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: DbCampaignMediaRow): CampaignMediaRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      campaignId: row.campaign_id,
      kind: row.kind as CampaignMediaRecord["kind"],
      originalName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
