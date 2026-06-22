import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "../../../../../../../lib/server-api";

// This is the OAuth redirect_uri registered with Google for the Sheets export
// flow (GOOGLE_SHEETS_OAUTH_REDIRECT_URI) — the browser lands here directly after
// the user approves access on Google's consent screen.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const redirectBase = `${url.origin}/analytics`;

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(`${redirectBase}?sheetsError=${encodeURIComponent(providerError)}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("epe_sheets_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${redirectBase}?sheetsError=state_mismatch`);
  }

  const res = await apiFetch("/analytics/export/google-sheets/exchange", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });
  const payload = (await res.json().catch(() => null)) as { success?: boolean; data?: { spreadsheetUrl?: string } } | null;

  const response = res.ok && payload?.data?.spreadsheetUrl
    ? NextResponse.redirect(payload.data.spreadsheetUrl)
    : NextResponse.redirect(`${redirectBase}?sheetsError=exchange_failed`);

  response.cookies.set("epe_sheets_oauth_state", "", { path: "/", maxAge: 0 });

  return response;
}
