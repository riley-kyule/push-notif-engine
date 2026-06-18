import { NextResponse } from "next/server";
import { resolveLogin } from "../../../../../lib/auth-session";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const credentials = body as { email?: string; password?: string };
  const email = typeof credentials.email === "string" ? credentials.email : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  const login = await resolveLogin({ email, password });

  if (!login.ok) {
    return NextResponse.json({ success: false, error: login.error }, { status: login.status });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const cookieBase = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
  };

  const response = NextResponse.json({ success: true });
  response.cookies.set("epe_access_token", login.tokens.accessToken, {
    ...cookieBase,
    maxAge: 60 * 15,
  });
  if (login.tokens.refreshToken) {
    response.cookies.set("epe_refresh_token", login.tokens.refreshToken, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
