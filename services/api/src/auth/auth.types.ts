export type RoleSlug = "super-admin" | "admin" | "editor" | "analyst";

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
  role: RoleSlug;
  jti?: string;
  type: "access" | "refresh";
}
