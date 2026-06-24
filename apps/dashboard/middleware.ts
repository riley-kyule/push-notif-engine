import { NextRequest, NextResponse } from "next/server";

import { attachAuthCookies } from "./lib/auth-cookies";

const PUBLIC_PREFIX = ["/login", "/api/dashboard/auth/"];

function getApiBase(): string {
  return process.env.DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
}

interface RefreshResponse {
  data?: {
    tokens?: {
      accessToken?: string;
      refreshToken?: string;
    };
  };
}

async function tryRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const response = await fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RefreshResponse;
    const accessToken = payload?.data?.tokens?.accessToken;
    if (!accessToken) {
      return null;
    }

    return {
      accessToken,
      ...(payload.data?.tokens?.refreshToken ? { refreshToken: payload.data.tokens.refreshToken } : {}),
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (request.cookies.get("epe_access_token")) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("epe_refresh_token");
  if (refreshToken) {
    const refreshed = await tryRefresh(refreshToken.value);
    if (refreshed) {
      const response = NextResponse.next();
      attachAuthCookies(response, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? refreshToken.value,
      });
      return response;
    }
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icon\\.svg|.*\\.png|.*\\.ico).*)"],
};
