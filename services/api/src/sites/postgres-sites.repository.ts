import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type { SiteListFilters, SiteListResult, SiteRecord, SiteRestApiCredentialsRecord, SiteStatus } from "./sites.types";
import type { CreateSiteInput, SiteAutomationDefaultsRecord, SitesRepository, UpdateSiteInput } from "./sites.repository";

interface DbSiteRow {
  id: string;
  name: string;
  url: string;
  country: string;
  timezone: string | null;
  language: string;
  platform: string;
  logo_url: string | null;
  app_name: string | null;
  icon_url: string | null;
  theme_color: string | null;
  opt_in_prompt_type: "lightbox-1" | "lightbox-2" | "bell-icon" | null;
  opt_in_prompt_animation: "slide-in" | "fade-in" | "pop" | null;
  opt_in_prompt_background_color: string | null;
  opt_in_prompt_headline: string | null;
  opt_in_prompt_headline_text_color: string | null;
  opt_in_prompt_text: string | null;
  opt_in_prompt_text_color: string | null;
  opt_in_prompt_icon_url: string | null;
  opt_in_prompt_cancel_button_label: string | null;
  opt_in_prompt_cancel_button_text_color: string | null;
  opt_in_prompt_cancel_button_background_color: string | null;
  opt_in_prompt_approve_button_label: string | null;
  opt_in_prompt_approve_button_text_color: string | null;
  opt_in_prompt_approve_button_background_color: string | null;
  opt_in_prompt_reprompt_delay_days: number | null;
  opt_in_prompt_recent_notifications_limit: number | null;
  rest_api_key_id: string | null;
  rest_api_auth_token_hash: string | null;
  rest_api_auth_token_last4: string | null;
  rest_api_credentials_generated_at: string | null;
  vapid_subject: string | null;
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  status: SiteStatus;
  last_connected_at: string | null;
  subscriber_count: string | number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresSitesRepository implements SitesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async create(input: CreateSiteInput): Promise<SiteRecord> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      INSERT INTO sites (name, url, country, language, platform, logo_url, app_name, icon_url, theme_color, opt_in_prompt_type, opt_in_prompt_animation, opt_in_prompt_background_color, opt_in_prompt_headline, opt_in_prompt_headline_text_color, opt_in_prompt_text, opt_in_prompt_text_color, opt_in_prompt_icon_url, opt_in_prompt_cancel_button_label, opt_in_prompt_cancel_button_text_color, opt_in_prompt_cancel_button_background_color, opt_in_prompt_approve_button_label, opt_in_prompt_approve_button_text_color, opt_in_prompt_approve_button_background_color, opt_in_prompt_reprompt_delay_days, opt_in_prompt_recent_notifications_limit, rest_api_key_id, rest_api_auth_token_hash, rest_api_auth_token_last4, rest_api_credentials_generated_at, vapid_subject, vapid_public_key, vapid_private_key, status, timezone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      RETURNING id, name, url, country, language, platform, logo_url, app_name, icon_url, theme_color, opt_in_prompt_type, opt_in_prompt_animation, opt_in_prompt_background_color, opt_in_prompt_headline, opt_in_prompt_headline_text_color, opt_in_prompt_text, opt_in_prompt_text_color, opt_in_prompt_icon_url, opt_in_prompt_cancel_button_label, opt_in_prompt_cancel_button_text_color, opt_in_prompt_cancel_button_background_color, opt_in_prompt_approve_button_label, opt_in_prompt_approve_button_text_color, opt_in_prompt_approve_button_background_color, opt_in_prompt_reprompt_delay_days, opt_in_prompt_recent_notifications_limit, rest_api_key_id, rest_api_auth_token_last4, rest_api_credentials_generated_at, vapid_subject, vapid_public_key, vapid_private_key, status, timezone, last_connected_at, 0 AS subscriber_count, created_at, updated_at
      `,
      [
        input.name,
        input.url,
        input.country,
        input.language,
        input.platform,
        input.logoUrl,
        input.appName,
        input.iconUrl,
        input.themeColor,
        input.optInPromptType,
        input.optInPromptAnimation,
        input.optInPromptBackgroundColor,
        input.optInPromptHeadline,
        input.optInPromptHeadlineTextColor,
        input.optInPromptText,
        input.optInPromptTextColor,
        input.optInPromptIconUrl,
        input.optInPromptCancelButtonLabel,
        input.optInPromptCancelButtonTextColor,
        input.optInPromptCancelButtonBackgroundColor,
        input.optInPromptApproveButtonLabel,
        input.optInPromptApproveButtonTextColor,
        input.optInPromptApproveButtonBackgroundColor,
        input.optInPromptRepromptDelayDays,
        input.optInPromptRecentNotificationsLimit,
        input.restApiKeyId ?? null,
        input.restApiAuthTokenHash ?? null,
        input.restApiAuthTokenLast4 ?? null,
        input.restApiCredentialsGeneratedAt ?? null,
        input.vapidSubject,
        input.vapidPublicKey,
        input.vapidPrivateKey,
        input.status,
        input.timezone,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create site");
    }

    return this.mapRow(row);
  }

  async update(id: string, input: UpdateSiteInput): Promise<SiteRecord | null> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      UPDATE sites
      SET name = COALESCE($2, name),
          url = COALESCE($3, url),
          country = COALESCE($4, country),
          language = COALESCE($5, language),
          platform = COALESCE($6, platform),
          logo_url = COALESCE($7, logo_url),
          app_name = COALESCE($8, app_name),
          icon_url = COALESCE($9, icon_url),
          theme_color = COALESCE($10, theme_color),
          opt_in_prompt_type = COALESCE($11, opt_in_prompt_type),
          opt_in_prompt_animation = COALESCE($12, opt_in_prompt_animation),
          opt_in_prompt_background_color = COALESCE($13, opt_in_prompt_background_color),
          opt_in_prompt_headline = COALESCE($14, opt_in_prompt_headline),
          opt_in_prompt_headline_text_color = COALESCE($15, opt_in_prompt_headline_text_color),
          opt_in_prompt_text = COALESCE($16, opt_in_prompt_text),
          opt_in_prompt_text_color = COALESCE($17, opt_in_prompt_text_color),
          opt_in_prompt_icon_url = COALESCE($18, opt_in_prompt_icon_url),
          opt_in_prompt_cancel_button_label = COALESCE($19, opt_in_prompt_cancel_button_label),
          opt_in_prompt_cancel_button_text_color = COALESCE($20, opt_in_prompt_cancel_button_text_color),
          opt_in_prompt_cancel_button_background_color = COALESCE($21, opt_in_prompt_cancel_button_background_color),
          opt_in_prompt_approve_button_label = COALESCE($22, opt_in_prompt_approve_button_label),
          opt_in_prompt_approve_button_text_color = COALESCE($23, opt_in_prompt_approve_button_text_color),
          opt_in_prompt_approve_button_background_color = COALESCE($24, opt_in_prompt_approve_button_background_color),
          opt_in_prompt_reprompt_delay_days = COALESCE($25, opt_in_prompt_reprompt_delay_days),
          opt_in_prompt_recent_notifications_limit = COALESCE($26, opt_in_prompt_recent_notifications_limit),
          rest_api_key_id = COALESCE($27, rest_api_key_id),
          rest_api_auth_token_hash = COALESCE($28, rest_api_auth_token_hash),
          rest_api_auth_token_last4 = COALESCE($29, rest_api_auth_token_last4),
          rest_api_credentials_generated_at = COALESCE($30, rest_api_credentials_generated_at),
          vapid_subject = COALESCE($31, vapid_subject),
          vapid_public_key = COALESCE($32, vapid_public_key),
          vapid_private_key = COALESCE($33, vapid_private_key),
          status = COALESCE($34, status),
          timezone = COALESCE($35, timezone),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, url, country, language, platform, logo_url, app_name, icon_url, theme_color, opt_in_prompt_type, opt_in_prompt_animation, opt_in_prompt_background_color, opt_in_prompt_headline, opt_in_prompt_headline_text_color, opt_in_prompt_text, opt_in_prompt_text_color, opt_in_prompt_icon_url, opt_in_prompt_cancel_button_label, opt_in_prompt_cancel_button_text_color, opt_in_prompt_cancel_button_background_color, opt_in_prompt_approve_button_label, opt_in_prompt_approve_button_text_color, opt_in_prompt_approve_button_background_color, opt_in_prompt_reprompt_delay_days, opt_in_prompt_recent_notifications_limit, rest_api_key_id, rest_api_auth_token_last4, rest_api_credentials_generated_at, vapid_subject, vapid_public_key, vapid_private_key, status, timezone, last_connected_at, (SELECT COUNT(*)::int FROM subscribers sub WHERE sub.site_id = sites.id) AS subscriber_count, created_at, updated_at
      `,
      [
        id,
        input.name ?? null,
        input.url ?? null,
        input.country ?? null,
        input.language ?? null,
        input.platform ?? null,
        input.logoUrl ?? null,
        input.appName ?? null,
        input.iconUrl ?? null,
        input.themeColor ?? null,
        input.optInPromptType ?? null,
        input.optInPromptAnimation ?? null,
        input.optInPromptBackgroundColor ?? null,
        input.optInPromptHeadline ?? null,
        input.optInPromptHeadlineTextColor ?? null,
        input.optInPromptText ?? null,
        input.optInPromptTextColor ?? null,
        input.optInPromptIconUrl ?? null,
        input.optInPromptCancelButtonLabel ?? null,
        input.optInPromptCancelButtonTextColor ?? null,
        input.optInPromptCancelButtonBackgroundColor ?? null,
        input.optInPromptApproveButtonLabel ?? null,
        input.optInPromptApproveButtonTextColor ?? null,
        input.optInPromptApproveButtonBackgroundColor ?? null,
        input.optInPromptRepromptDelayDays ?? null,
        input.optInPromptRecentNotificationsLimit ?? null,
        input.restApiKeyId ?? null,
        input.restApiAuthTokenHash ?? null,
        input.restApiAuthTokenLast4 ?? null,
        input.restApiCredentialsGeneratedAt ?? null,
        input.vapidSubject ?? null,
        input.vapidPublicKey ?? null,
        input.vapidPrivateKey ?? null,
        input.status ?? null,
        input.timezone ?? null,
      ],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findById(id: string): Promise<SiteRecord | null> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      SELECT id, name, url, country, language, platform, logo_url, app_name, icon_url, theme_color, opt_in_prompt_type, opt_in_prompt_animation, opt_in_prompt_background_color, opt_in_prompt_headline, opt_in_prompt_headline_text_color, opt_in_prompt_text, opt_in_prompt_text_color, opt_in_prompt_icon_url, opt_in_prompt_cancel_button_label, opt_in_prompt_cancel_button_text_color, opt_in_prompt_cancel_button_background_color, opt_in_prompt_approve_button_label, opt_in_prompt_approve_button_text_color, opt_in_prompt_approve_button_background_color, opt_in_prompt_reprompt_delay_days, opt_in_prompt_recent_notifications_limit, rest_api_key_id, rest_api_auth_token_hash, rest_api_auth_token_last4, rest_api_credentials_generated_at, vapid_subject, vapid_public_key, vapid_private_key, status, timezone, last_connected_at, (SELECT COUNT(*)::int FROM subscribers sub WHERE sub.site_id = sites.id) AS subscriber_count, created_at, updated_at
      FROM sites
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findAutomationDefaultsById(id: string): Promise<SiteAutomationDefaultsRecord | null> {
    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      url: string;
    }>(
      `
      SELECT id, name, url
      FROM sites
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row ? { id: row.id, name: row.name, url: row.url } : null;
  }

  async findByUrl(url: string): Promise<SiteRecord | null> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      SELECT id, name, url, country, language, platform, logo_url, app_name, icon_url, theme_color, opt_in_prompt_type, opt_in_prompt_animation, opt_in_prompt_background_color, opt_in_prompt_headline, opt_in_prompt_headline_text_color, opt_in_prompt_text, opt_in_prompt_text_color, opt_in_prompt_icon_url, opt_in_prompt_cancel_button_label, opt_in_prompt_cancel_button_text_color, opt_in_prompt_cancel_button_background_color, opt_in_prompt_approve_button_label, opt_in_prompt_approve_button_text_color, opt_in_prompt_approve_button_background_color, opt_in_prompt_reprompt_delay_days, opt_in_prompt_recent_notifications_limit, rest_api_key_id, rest_api_auth_token_hash, rest_api_auth_token_last4, rest_api_credentials_generated_at, vapid_subject, vapid_public_key, vapid_private_key, status, timezone, last_connected_at, (SELECT COUNT(*)::int FROM subscribers sub WHERE sub.site_id = sites.id) AS subscriber_count, created_at, updated_at
      FROM sites
      WHERE LOWER(url) = LOWER($1)
      LIMIT 1
      `,
      [url],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findByName(name: string): Promise<SiteRecord | null> {
    const { rows } = await this.pool.query<DbSiteRow>(
      `
      SELECT id, name, url, country, language, platform, logo_url, app_name, icon_url, theme_color, opt_in_prompt_type, opt_in_prompt_animation, opt_in_prompt_background_color, opt_in_prompt_headline, opt_in_prompt_headline_text_color, opt_in_prompt_text, opt_in_prompt_text_color, opt_in_prompt_icon_url, opt_in_prompt_cancel_button_label, opt_in_prompt_cancel_button_text_color, opt_in_prompt_cancel_button_background_color, opt_in_prompt_approve_button_label, opt_in_prompt_approve_button_text_color, opt_in_prompt_approve_button_background_color, opt_in_prompt_reprompt_delay_days, opt_in_prompt_recent_notifications_limit, rest_api_key_id, rest_api_auth_token_hash, rest_api_auth_token_last4, rest_api_credentials_generated_at, vapid_subject, vapid_public_key, vapid_private_key, status, timezone, last_connected_at, (SELECT COUNT(*)::int FROM subscribers sub WHERE sub.site_id = sites.id) AS subscriber_count, created_at, updated_at
      FROM sites
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
      `,
      [name],
    );

    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findByIdWithRestApiCredentials(id: string): Promise<SiteRestApiCredentialsRecord | null> {
    const { rows } = await this.pool.query<Pick<DbSiteRow, "id" | "rest_api_key_id" | "rest_api_auth_token_hash">>(
      `
      SELECT id, rest_api_key_id, rest_api_auth_token_hash
      FROM sites
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    return row
      ? {
          id: row.id,
          restApiKeyId: row.rest_api_key_id,
          restApiAuthTokenHash: row.rest_api_auth_token_hash,
        }
      : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM sites WHERE id = $1", [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async list(filters: SiteListFilters): Promise<SiteListResult> {
    const query: string[] = [
      `SELECT id, name, url, country, language, platform, logo_url, app_name, icon_url, theme_color, opt_in_prompt_type, opt_in_prompt_animation, opt_in_prompt_background_color, opt_in_prompt_headline, opt_in_prompt_headline_text_color, opt_in_prompt_text, opt_in_prompt_text_color, opt_in_prompt_icon_url, opt_in_prompt_cancel_button_label, opt_in_prompt_cancel_button_text_color, opt_in_prompt_cancel_button_background_color, opt_in_prompt_approve_button_label, opt_in_prompt_approve_button_text_color, opt_in_prompt_approve_button_background_color, opt_in_prompt_reprompt_delay_days, opt_in_prompt_recent_notifications_limit, rest_api_key_id, rest_api_auth_token_last4, rest_api_credentials_generated_at, vapid_subject, vapid_public_key, vapid_private_key, status, timezone, last_connected_at, (SELECT COUNT(*)::int FROM subscribers sub WHERE sub.site_id = sites.id) AS subscriber_count, created_at, updated_at`,
      `FROM sites`,
    ];
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(`(name ILIKE $${params.length} OR url ILIKE $${params.length})`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.country) {
      params.push(filters.country);
      where.push(`country = $${params.length}`);
    }

    if (filters.language) {
      params.push(filters.language);
      where.push(`language = $${params.length}`);
    }

    if (where.length > 0) {
      query.push(`WHERE ${where.join(" AND ")}`);
    }

    // Mapped through an allowlist rather than interpolating filters.sortBy
    // directly -- it's already validated by ListSitesQueryDto's @IsIn, but
    // never build ORDER BY from a raw client-controlled string.
    const sortColumns: Record<NonNullable<SiteListFilters["sortBy"]>, string> = {
      name: "LOWER(name)",
      createdAt: "created_at",
      subscriberCount: "subscriber_count",
      connection: "last_connected_at",
      country: "country",
    };
    const sortColumn = sortColumns[filters.sortBy ?? "createdAt"];
    const sortDir = filters.sortDir === "asc" ? "ASC" : "DESC";
    query.push(`ORDER BY ${sortColumn} ${sortDir} NULLS LAST, created_at DESC`);
    params.push(filters.limit, filters.offset);
    query.push(`LIMIT $${params.length - 1} OFFSET $${params.length}`);

    const countQuery = [`SELECT COUNT(*)::int AS total FROM sites`];
    if (where.length > 0) {
      countQuery.push(`WHERE ${where.join(" AND ")}`);
    }

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<DbSiteRow>(query.join(" "), params),
      this.pool.query<{ total: number }>(countQuery.join(" "), params.slice(0, params.length - 2)),
    ]);

    return {
      items: itemsResult.rows.map((row) => this.mapRow(row)),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  private mapRow(row: DbSiteRow): SiteRecord {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      country: row.country,
      timezone: row.timezone,
      language: row.language,
      platform: row.platform,
      logoUrl: row.logo_url,
      appName: row.app_name ?? row.name,
      iconUrl: row.icon_url,
      themeColor: row.theme_color,
      optInPromptType: row.opt_in_prompt_type ?? "lightbox-1",
      optInPromptAnimation: row.opt_in_prompt_animation ?? "slide-in",
      optInPromptBackgroundColor: row.opt_in_prompt_background_color,
      optInPromptHeadline: row.opt_in_prompt_headline,
      optInPromptHeadlineTextColor: row.opt_in_prompt_headline_text_color,
      optInPromptText: row.opt_in_prompt_text,
      optInPromptTextColor: row.opt_in_prompt_text_color,
      optInPromptIconUrl: row.opt_in_prompt_icon_url,
      optInPromptCancelButtonLabel: row.opt_in_prompt_cancel_button_label,
      optInPromptCancelButtonTextColor: row.opt_in_prompt_cancel_button_text_color,
      optInPromptCancelButtonBackgroundColor: row.opt_in_prompt_cancel_button_background_color,
      optInPromptApproveButtonLabel: row.opt_in_prompt_approve_button_label,
      optInPromptApproveButtonTextColor: row.opt_in_prompt_approve_button_text_color,
      optInPromptApproveButtonBackgroundColor: row.opt_in_prompt_approve_button_background_color,
      optInPromptRepromptDelayDays: row.opt_in_prompt_reprompt_delay_days,
      optInPromptRecentNotificationsLimit: row.opt_in_prompt_recent_notifications_limit,
      restApiKeyId: row.rest_api_key_id,
      restApiAuthTokenLast4: row.rest_api_auth_token_last4,
      restApiCredentialsGeneratedAt: row.rest_api_credentials_generated_at ? new Date(row.rest_api_credentials_generated_at) : null,
      vapidSubject: row.vapid_subject,
      vapidPublicKey: row.vapid_public_key,
      vapidPrivateKey: row.vapid_private_key,
      status: row.status,
      lastConnectedAt: row.last_connected_at ? new Date(row.last_connected_at) : null,
      subscriberCount: Number(row.subscriber_count),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async recordConnection(id: string): Promise<void> {
    await this.pool.query("UPDATE sites SET last_connected_at = NOW() WHERE id = $1", [id]);
  }
}
