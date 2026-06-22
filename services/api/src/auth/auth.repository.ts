import type { AuthenticatedUser, RoleSlug } from "./auth.types";

export interface AuthUserRecord extends AuthenticatedUser {
  passwordHash: string | null;
  isActive: boolean;
  authProvider: "local" | "google";
  googleSubject: string | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
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
  findUserByGoogleSubject(subject: string): Promise<AuthUserRecord | null>;
  findRoleBySlug(slug: RoleSlug): Promise<RoleRecord | null>;
  storeRefreshToken(record: RefreshTokenRecord): Promise<void>;
  findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
  linkGoogleIdentity(userId: string, googleSubject: string, emailVerifiedAt: Date): Promise<void>;
  recordLastLogin(userId: string, at: Date): Promise<void>;
}
