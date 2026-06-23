import { Injectable } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { Pool } from "pg";

import { DATABASE_POOL } from "../database/database.constants";
import type {
  AuthRepository,
  AuthUserRecord,
  CreateUserInput,
  RefreshTokenRecord,
  RoleRecord,
  UpdateRoleInput,
} from "./auth.repository";
import type { PermissionSlug, RoleSlug } from "./auth.types";

interface DbUserRow {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
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

interface DbRoleRow {
  id: string;
  slug: RoleSlug;
  name: string;
  permissions: string[] | null;
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

  private mapUserRow(row: DbUserRow): AuthUserRecord {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
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

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.username,
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

    return this.mapUserRow(row);
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.username,
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

    return this.mapUserRow(row);
  }

  async findUserByGoogleSubject(subject: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.username,
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

    return this.mapUserRow(row);
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.username,
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
      WHERE lower(u.username) = lower($1)
      LIMIT 1
      `,
      [username],
    );

    const row = rows[0];
    return row ? this.mapUserRow(row) : null;
  }

  async listUsers(): Promise<AuthUserRecord[]> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.username,
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
      ORDER BY u.created_at DESC
      `,
    );

    return rows.map((row) => this.mapUserRow(row));
  }

  async createUser(input: CreateUserInput): Promise<AuthUserRecord> {
    const role = await this.findRoleBySlug(input.role);
    if (!role) {
      throw new Error(`Role ${input.role} not found`);
    }

    const { rows } = await this.pool.query<DbUserRow>(
      `
      INSERT INTO users (
        role_id,
        first_name,
        last_name,
        username,
        email,
        name,
        password_hash,
        is_active,
        auth_provider,
        google_subject,
        email_verified_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, first_name, last_name, username, email, name, password_hash, $12::text AS role_slug, is_active, auth_provider, google_subject, email_verified_at, NULL::timestamptz AS last_login_at
      `,
      [
        role.id,
        input.firstName,
        input.lastName,
        input.username,
        input.email,
        input.name,
        input.passwordHash,
        input.isActive ?? true,
        input.authProvider ?? "local",
        input.googleSubject ?? null,
        input.emailVerifiedAt ?? null,
        input.role,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create user");
    }

    return this.mapUserRow(row);
  }

  async updateUserRole(userId: string, role: RoleSlug): Promise<AuthUserRecord | null> {
    const roleRecord = await this.findRoleBySlug(role);
    if (!roleRecord) {
      return null;
    }

    const { rows } = await this.pool.query<DbUserRow>(
      `
      UPDATE users
      SET role_id = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        first_name,
        last_name,
        username,
        email,
        name,
        password_hash,
        $3::text AS role_slug,
        is_active,
        auth_provider,
        google_subject,
        email_verified_at,
        last_login_at
      `,
      [userId, roleRecord.id, role],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.mapUserRow(row);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<AuthUserRecord | null> {
    const { rows } = await this.pool.query<DbUserRow>(
      `
      UPDATE users u
      SET password_hash = $2,
          updated_at = NOW()
      WHERE u.id = $1
      RETURNING
        u.id,
        u.first_name,
        u.last_name,
        u.username,
        u.email,
        u.name,
        u.password_hash,
        (SELECT r.slug FROM roles r WHERE r.id = u.role_id) AS role_slug,
        u.is_active,
        u.auth_provider,
        u.google_subject,
        u.email_verified_at,
        u.last_login_at
      `,
      [userId, passwordHash],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return this.mapUserRow(row);
  }

  async findRoleBySlug(slug: RoleSlug): Promise<RoleRecord | null> {
    const { rows } = await this.pool.query<DbRoleRow>(
      `SELECT id, slug, name, permissions FROM roles WHERE slug = $1 LIMIT 1`,
      [slug],
    );

    const row = rows[0];
    return row
      ? {
          id: row.id,
          slug: row.slug,
          name: row.name,
          permissions: Array.isArray(row.permissions) ? (row.permissions as PermissionSlug[]) : [],
        }
      : null;
  }

  async listRoles(): Promise<RoleRecord[]> {
    const { rows } = await this.pool.query<DbRoleRow>(
      `SELECT id, slug, name, permissions FROM roles ORDER BY created_at ASC`,
    );

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      permissions: Array.isArray(row.permissions) ? (row.permissions as PermissionSlug[]) : [],
    }));
  }

  async updateRole(slug: RoleSlug, input: UpdateRoleInput): Promise<RoleRecord | null> {
    const { rows } = await this.pool.query<DbRoleRow>(
      `
      UPDATE roles
      SET name = COALESCE($2, name),
          permissions = COALESCE($3::jsonb, permissions),
          updated_at = NOW()
      WHERE slug = $1
      RETURNING id, slug, name, permissions
      `,
      [slug, input.name ?? null, input.permissions ? JSON.stringify(input.permissions) : null],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      permissions: Array.isArray(row.permissions) ? (row.permissions as PermissionSlug[]) : [],
    };
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
