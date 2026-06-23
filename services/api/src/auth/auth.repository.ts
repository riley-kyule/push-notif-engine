import type { AuthenticatedUser, PermissionSlug, RoleSlug } from "./auth.types";

export interface AuthUserRecord extends AuthenticatedUser {
  firstName: string;
  lastName: string;
  username: string;
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
  permissions: PermissionSlug[];
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

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  name: string;
  role: RoleSlug;
  passwordHash: string | null;
  isActive?: boolean;
  authProvider?: "local" | "google";
  googleSubject?: string | null;
  emailVerifiedAt?: Date | null;
}

export interface UpdateRoleInput {
  name?: string;
  permissions?: PermissionSlug[];
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  findUserByGoogleSubject(subject: string): Promise<AuthUserRecord | null>;
  findUserByUsername(username: string): Promise<AuthUserRecord | null>;
  listUsers(): Promise<AuthUserRecord[]>;
  createUser(input: CreateUserInput): Promise<AuthUserRecord>;
  updateUserRole(userId: string, role: RoleSlug): Promise<AuthUserRecord | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<AuthUserRecord | null>;
  findRoleBySlug(slug: RoleSlug): Promise<RoleRecord | null>;
  listRoles(): Promise<RoleRecord[]>;
  updateRole(slug: RoleSlug, input: UpdateRoleInput): Promise<RoleRecord | null>;
  storeRefreshToken(record: RefreshTokenRecord): Promise<void>;
  findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
  linkGoogleIdentity(userId: string, googleSubject: string, emailVerifiedAt: Date): Promise<void>;
  recordLastLogin(userId: string, at: Date): Promise<void>;
}
