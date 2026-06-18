export interface AuthConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return parsed;
}

export function loadAuthConfig(): AuthConfig {
  return {
    accessTokenSecret: readRequiredEnv("JWT_ACCESS_SECRET"),
    refreshTokenSecret: readRequiredEnv("JWT_REFRESH_SECRET"),
    accessTokenTtlSeconds: readPositiveInteger("JWT_ACCESS_TTL_SECONDS", 900),
    refreshTokenTtlSeconds: readPositiveInteger("JWT_REFRESH_TTL_SECONDS", 60 * 60 * 24 * 30),
  };
}
