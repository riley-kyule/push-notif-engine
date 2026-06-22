import { NextResponse } from "next/server";

import { attachAuthCookies } from "../../../../../lib/auth-cookies";
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

  const response = NextResponse.json({ success: true });
  attachAuthCookies(response, login.tokens);

  return response;
}
