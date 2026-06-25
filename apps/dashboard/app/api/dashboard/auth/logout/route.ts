import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function POST(): Promise<Response> {
  // Revoke the refresh token server-side before clearing cookies -- without
  // this, a refresh token captured before logout (XSS, a shared machine, a
  // synced browser) would stay valid for its full 30-day lifetime regardless
  // of the user clicking "log out."
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("epe_refresh_token")?.value;
  if (refreshToken) {
    await apiFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("epe_access_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("epe_refresh_token", "", { maxAge: 0, path: "/" });
  return response;
}
