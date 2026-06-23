export type RoleSlug = "super-admin" | "admin" | "sub-admin" | "customer-service" | "editor" | "analyst";

export type PermissionSlug =
  | "users:manage"
  | "roles:manage"
  | "automations:manage"
  | "sites:manage"
  | "sites:settings"
  | "analytics:view"
  | "subscribers:view"
  | "campaigns:manage"
  | "campaigns:assigned"
  | "campaign-taxonomies:manage"
  | "segments:manage"
  | "audit-logs:view"
  | "system-health:view"
  | "backups:manage";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: RoleSlug;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

export interface LoginResult {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  role: RoleSlug;
  jti?: string;
  type: "access" | "refresh";
}
