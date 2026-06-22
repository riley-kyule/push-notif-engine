import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../../lib/server-api";

// Issues the Google authorize URL (Sheets write scope) and stores the OAuth `state`
// in a short-lived httpOnly cookie, mirroring the backup connection flow's CSRF
// protection — the callback route confirms the code it receives belongs to a flow
// this browser actually started before exchanging it.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "overview";
  const days = url.searchParams.get("days") ?? "30";

  const res = await apiFetch(`/analytics/export/google-sheets/authorize-url?report=${encodeURIComponent(report)}&days=${encodeURIComponent(days)}`);
  const payload = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: { authorizeUrl?: string; state?: string } }
    | null;

  if (!res.ok || !payload?.data?.authorizeUrl || !payload.data.state) {
    return NextResponse.json(
      { success: false, error: { message: "Unable to start the Google Sheets export" } },
      { status: res.status === 200 ? 502 : res.status },
    );
  }

  const response = NextResponse.json({ success: true, data: { authorizeUrl: payload.data.authorizeUrl } });
  response.cookies.set("epe_sheets_oauth_state", payload.data.state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
