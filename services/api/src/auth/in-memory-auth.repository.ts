import crypto from "node:crypto";

import type {
  AuthRepository,
  AuthUserRecord,
  CreateUserInput,
  RefreshTokenRecord,
  RoleRecord,
  UpdateRoleInput,
} from "./auth.repository";
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

  async findUserByGoogleSubject(subject: string): Promise<AuthUserRecord | null> {
    for (const user of this.users.values()) {
      if (user.googleSubject === subject) {
        return user;
      }
    }

    return null;
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | null> {
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === username.toLowerCase()) {
        return user;
      }
    }

    return null;
  }

  async listUsers(): Promise<AuthUserRecord[]> {
    const seen = new Set<string>();
    const users: AuthUserRecord[] = [];
    for (const user of this.users.values()) {
      if (seen.has(user.id)) {
        continue;
      }
      seen.add(user.id);
      users.push(user);
    }

    return users;
  }

  async createUser(input: CreateUserInput): Promise<AuthUserRecord> {
    const role = this.roles.get(input.role);
    if (!role) {
      throw new Error(`Role ${input.role} not found`);
    }

      const user: AuthUserRecord = {
        id: crypto.randomUUID(),
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      isActive: input.isActive ?? true,
      authProvider: input.authProvider ?? "local",
      googleSubject: input.googleSubject ?? null,
      emailVerifiedAt: input.emailVerifiedAt ?? null,
      lastLoginAt: null,
    };
    this.users.set(user.email.toLowerCase(), user);
    this.users.set(user.id, user);
    return user;
  }

  async updateUserRole(userId: string, role: RoleSlug): Promise<AuthUserRecord | null> {
    const user = this.users.get(userId);
    if (!user || !this.roles.get(role)) {
      return null;
    }

    const updated: AuthUserRecord = {
      ...user,
      role,
    };
    this.users.set(user.email.toLowerCase(), updated);
    this.users.set(user.id, updated);
    return updated;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<AuthUserRecord | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const updated: AuthUserRecord = {
      ...user,
      passwordHash,
    };
    this.users.set(user.email.toLowerCase(), updated);
    this.users.set(user.id, updated);
    return updated;
  }

  async findRoleBySlug(slug: RoleSlug): Promise<RoleRecord | null> {
    return this.roles.get(slug) ?? null;
  }

  async listRoles(): Promise<RoleRecord[]> {
    return [...this.roles.values()];
  }

  async updateRole(slug: RoleSlug, input: UpdateRoleInput): Promise<RoleRecord | null> {
    const existing = this.roles.get(slug);
    if (!existing) {
      return null;
    }

    const updated: RoleRecord = {
      ...existing,
      name: input.name ?? existing.name,
      permissions: input.permissions ?? existing.permissions,
    };
    this.roles.set(slug, updated);
    return updated;
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

  async linkGoogleIdentity(userId: string, googleSubject: string, emailVerifiedAt: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      return;
    }

    const updated: AuthUserRecord = {
      ...user,
      authProvider: "google",
      googleSubject,
      emailVerifiedAt: user.emailVerifiedAt ?? emailVerifiedAt,
    };
    this.users.set(user.email.toLowerCase(), updated);
    this.users.set(user.id, updated);
  }

  async recordLastLogin(userId: string, at: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      return;
    }

    const updated: AuthUserRecord = {
      ...user,
      lastLoginAt: at,
    };
    this.users.set(user.email.toLowerCase(), updated);
    this.users.set(user.id, updated);
  }
}
