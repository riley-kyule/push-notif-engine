import type { AuthRepository, AuthUserRecord, RefreshTokenRecord, RoleRecord } from "./auth.repository";
import type { RoleSlug } from "./auth.types";

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly roles = new Map<RoleSlug, RoleRecord>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();

  constructor(seed?: { users?: AuthUserRecord[]; roles?: RoleRecord[]; refreshTokens?: RefreshTokenRecord[] }) {
    for (const role of seed?.roles ?? []) {
      this.roles.set(role.slug, role);
    }

    for (const user of seed?.users ?? []) {
      this.users.set(user.email.toLowerCase(), user);
      this.users.set(user.id, user);
    }

    for (const token of seed?.refreshTokens ?? []) {
      this.refreshTokens.set(token.id, token);
    }
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.users.get(email.toLowerCase()) ?? null;
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async findRoleBySlug(slug: RoleSlug): Promise<RoleRecord | null> {
    return this.roles.get(slug) ?? null;
  }

  async storeRefreshToken(record: RefreshTokenRecord): Promise<void> {
    this.refreshTokens.set(record.id, record);
  }

  async findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null> {
    return this.refreshTokens.get(id) ?? null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    const existing = this.refreshTokens.get(id);
    if (!existing) {
      return;
    }

    this.refreshTokens.set(id, {
      ...existing,
      revokedAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
