import crypto from "node:crypto";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginSuccess {
  ok: true;
  tokens: AuthTokens;
  source: "api" | "local-fallback";
}

export interface LoginFailure {
  ok: false;
  status: number;
  error: string;
}

export type LoginResolution = LoginSuccess | LoginFailure;

export const DEV_LOGIN_EMAIL = "admin@example.com";
export const DEV_LOGIN_PASSWORD = "Password123!";

interface ApiLoginResponse {
  data?: {
    tokens?: {
      accessToken?: string;
      refreshToken?: string;
    };
  };
  message?: string;
  error?: string;
}

export function getApiBase(): string {
  return process.env.DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
}

export function canUseLocalAuthFallback(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.DASHBOARD_ALLOW_LOCAL_AUTH_FALLBACK !== "false";
}

function isDevFallbackCredentials(credentials: LoginCredentials): boolean {
  return credentials.email.toLowerCase() === DEV_LOGIN_EMAIL && credentials.password === DEV_LOGIN_PASSWORD;
}

function createLocalTokens(): AuthTokens {
  return {
    accessToken: `local-access-${crypto.randomUUID()}`,
    refreshToken: `local-refresh-${crypto.randomUUID()}`,
  };
}

function extractErrorMessage(payload: ApiLoginResponse | null): string {
  return payload?.message ?? payload?.error ?? "Invalid credentials";
}

export async function resolveLogin(
  credentials: LoginCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<LoginResolution> {
  const apiBase = getApiBase();

  try {
    const response = await fetchImpl(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiLoginResponse | null;
      return {
        ok: false,
        status: response.status,
        error: extractErrorMessage(payload),
      };
    }

    const payload = (await response.json()) as ApiLoginResponse;
    const accessToken = payload?.data?.tokens?.accessToken;
    const refreshToken = payload?.data?.tokens?.refreshToken;

    if (!accessToken) {
      return {
        ok: false,
        status: 502,
        error: "Malformed auth response",
      };
    }

    return {
      ok: true,
      source: "api",
      tokens: {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
      },
    };
  } catch {
    if (!canUseLocalAuthFallback() || !isDevFallbackCredentials(credentials)) {
      return {
        ok: false,
        status: 502,
        error: "Cannot reach API server",
      };
    }

    return {
      ok: true,
      source: "local-fallback",
      tokens: createLocalTokens(),
    };
  }
}
