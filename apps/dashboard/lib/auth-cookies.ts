import type { NextResponse } from "next/server";

import type { AuthTokens } from "./auth-session";

export function attachAuthCookies(response: NextResponse, tokens: AuthTokens): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieBase = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };

  response.cookies.set("epe_access_token", tokens.accessToken, {
    ...cookieBase,
    maxAge: 60 * 15,
  });

  if (tokens.refreshToken) {
    response.cookies.set("epe_refresh_token", tokens.refreshToken, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
