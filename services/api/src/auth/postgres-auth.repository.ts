import { Injectable } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type {
  AuthRepository,
  AuthUserRecord,
  RefreshTokenRecord,
  RoleRecord,
} from "./auth.repository";
import type { RoleSlug } from "./auth.types";

interface DbUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role_slug: RoleSlug;
  is_active: boolean;
  auth_provider: "local" | "google";
  google_subject: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
}

interface DbRefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PostgresAuthRepository implements AuthRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.email,
        u.name,
        u.password_hash,
        r.slug AS role_slug,
        u.is_active,
        u.auth_provider,
        u.google_subject,
        u.email_verified_at,
        u.last_login_at
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE lower(u.email) = lower($1)
      LIMIT 1
      `,
      [email],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      role: row.role_slug,
      isActive: row.is_active,
      authProvider: row.auth_provider,
      googleSubject: row.google_subject,
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    };
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.email,
        u.name,
        u.password_hash,
        r.slug AS role_slug,
        u.is_active,
        u.auth_provider,
        u.google_subject,
        u.email_verified_at,
        u.last_login_at
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      role: row.role_slug,
      isActive: row.is_active,
      authProvider: row.auth_provider,
      googleSubject: row.google_subject,
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    };
  }

  async findUserByGoogleSubject(subject: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.email,
        u.name,
        u.password_hash,
        r.slug AS role_slug,
        u.is_active,
        u.auth_provider,
        u.google_subject,
        u.email_verified_at,
        u.last_login_at
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.google_subject = $1
      LIMIT 1
      `,
      [subject],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      role: row.role_slug,
      isActive: row.is_active,
      authProvider: row.auth_provider,
      googleSubject: row.google_subject,
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    };
  }

  async findRoleBySlug(slug: RoleSlug): Promise<RoleRecord | null> {
    const { rows } = await this.pool.query<{ id: string; slug: RoleSlug; name: string }>(
      `SELECT id, slug, name FROM roles WHERE slug = $1 LIMIT 1`,
      [slug],
    );

    const row = rows[0];
    return row ?? null;
  }

  async storeRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id)
      DO UPDATE SET
        token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        revoked_at = EXCLUDED.revoked_at,
        updated_at = EXCLUDED.updated_at
      `,
      [
        record.id,
        record.userId,
        record.tokenHash,
        record.expiresAt,
        record.revokedAt,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null> {
    const { rows } = await this.pool.query<DbRefreshTokenRow>(
      `
      SELECT id, user_id, token_hash, expires_at, revoked_at, created_at, updated_at
      FROM refresh_tokens
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [id],
    );
  }

  async linkGoogleIdentity(userId: string, googleSubject: string, emailVerifiedAt: Date): Promise<void> {
    await this.pool.query(
      `
      UPDATE users
      SET auth_provider = 'google',
          google_subject = $2,
          email_verified_at = COALESCE(email_verified_at, $3),
          updated_at = NOW()
      WHERE id = $1
      `,
      [userId, googleSubject, emailVerifiedAt],
    );
  }

  async recordLastLogin(userId: string, at: Date): Promise<void> {
    await this.pool.query(
      `
      UPDATE users
      SET last_login_at = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [userId, at],
    );
  }
}
