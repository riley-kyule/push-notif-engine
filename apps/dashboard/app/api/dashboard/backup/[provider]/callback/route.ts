import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { apiFetch } from "../../../../../../lib/server-api";

// This is the OAuth redirect_uri registered with Dropbox/Google — the browser lands
// here directly after the user approves (or denies) access on the provider's site.
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  const url = new URL(request.url);
  const redirectBase = `${url.origin}/platform/backup-config`;

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(providerError)}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(`epe_backup_oauth_state_${provider}`)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${redirectBase}?error=state_mismatch`);
  }

  const res = await apiFetch(`/backup/${provider}/exchange`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  const response = res.ok
    ? NextResponse.redirect(`${redirectBase}?connected=${encodeURIComponent(provider)}`)
    : NextResponse.redirect(`${redirectBase}?error=exchange_failed`);

  response.cookies.set(`epe_backup_oauth_state_${provider}`, "", { path: "/", maxAge: 0 });

  return response;
}
