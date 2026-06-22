import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type {
  ContentTaxonomiesRepository,
  CreateContentTaxonomyInput,
  UpdateContentTaxonomyInput,
} from "./campaign-taxonomies.repository";
import type { ContentTaxonomyListResult, ContentTaxonomyRecord } from "./campaign-taxonomies.types";

interface DbTaxonomyRow {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresContentTaxonomiesRepository implements ContentTaxonomiesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateContentTaxonomyInput): Promise<ContentTaxonomyRecord> {
    const { rows } = await this.pool.query<DbTaxonomyRow>(
      `
      INSERT INTO campaign_taxonomies (slug, label, description, is_active, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, slug, label, description, is_active, sort_order, created_at, updated_at
      `,
      [input.slug, input.label, input.description, input.isActive, input.sortOrder],
    );

    const row = rows[0];
    if (!row) throw new Error("Failed to create taxonomy");
    return this.mapRow(row);
  }

  async update(id: string, input: UpdateContentTaxonomyInput): Promise<ContentTaxonomyRecord | null> {
    const { rows } = await this.pool.query<DbTaxonomyRow>(
      `
      UPDATE campaign_taxonomies
      SET label = COALESCE($2, label),
          description = COALESCE($3, description),
          is_active = COALESCE($4, is_active),
          sort_order = COALESCE($5, sort_order),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, slug, label, description, is_active, sort_order, created_at, updated_at
      `,
      [id, input.label ?? null, input.description ?? null, input.isActive ?? null, input.sortOrder ?? null],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findById(id: string): Promise<ContentTaxonomyRecord | null> {
    const { rows } = await this.pool.query<DbTaxonomyRow>(
      `
      SELECT id, slug, label, description, is_active, sort_order, created_at, updated_at
      FROM campaign_taxonomies
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findBySlug(slug: string): Promise<ContentTaxonomyRecord | null> {
    const { rows } = await this.pool.query<DbTaxonomyRow>(
      `
      SELECT id, slug, label, description, is_active, sort_order, created_at, updated_at
      FROM campaign_taxonomies
      WHERE slug = $1
      LIMIT 1
      `,
      [slug],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async list(): Promise<ContentTaxonomyListResult> {
    const { rows } = await this.pool.query<DbTaxonomyRow>(
      `
      SELECT id, slug, label, description, is_active, sort_order, created_at, updated_at
      FROM campaign_taxonomies
      ORDER BY sort_order ASC, label ASC
      `,
    );

    return { items: rows.map((row) => this.mapRow(row)), total: rows.length };
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM campaign_taxonomies WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: DbTaxonomyRow): ContentTaxonomyRecord {
    return {
      id: row.id,
      slug: row.slug,
      label: row.label,
      description: row.description,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
