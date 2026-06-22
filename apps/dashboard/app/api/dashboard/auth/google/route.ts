import { NextResponse } from "next/server";

import { attachAuthCookies } from "../../../../../lib/auth-cookies";
import { apiFetch } from "../../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const payload = body as { idToken?: string };
  const idToken = typeof payload.idToken === "string" ? payload.idToken : "";
  if (idToken.length === 0) {
    return NextResponse.json({ success: false, error: "Missing Google token" }, { status: 400 });
  }

  const res = await apiFetch("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });

  const data = (await res.json().catch(() => null)) as
    | { data?: { tokens?: { accessToken?: string; refreshToken?: string } }; error?: string; message?: string }
    | null;

  if (!res.ok) {
    return NextResponse.json(
      {
        success: false,
        error: data?.message ?? data?.error ?? "Google sign-in failed",
      },
      { status: res.status },
    );
  }

  const accessToken = data?.data?.tokens?.accessToken;
  if (!accessToken) {
    return NextResponse.json({ success: false, error: "Malformed auth response" }, { status: 502 });
  }

  const response = NextResponse.json({ success: true });
  const tokens = data?.data?.tokens;
  attachAuthCookies(
    response,
    tokens?.refreshToken
      ? {
          accessToken,
          refreshToken: tokens.refreshToken,
        }
      : {
          accessToken,
        },
  );

  return response;
}
