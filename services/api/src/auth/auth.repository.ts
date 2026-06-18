import type { AuthenticatedUser, RoleSlug } from "./auth.types";

export interface AuthUserRecord extends AuthenticatedUser {
  passwordHash: string;
  isActive: boolean;
}

export interface RoleRecord {
  id: string;
  slug: RoleSlug;
  name: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  findRoleBySlug(slug: RoleSlug): Promise<RoleRecord | null>;
  storeRefreshToken(record: RefreshTokenRecord): Promise<void>;
  findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
}
