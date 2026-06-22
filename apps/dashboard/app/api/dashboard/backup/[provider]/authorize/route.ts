import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

// Issues the Dropbox/Google authorize URL and stores the OAuth `state` value in a
// short-lived httpOnly cookie scoped to this dashboard's origin. The callback route
// reads that same cookie to confirm the code it receives belongs to a flow this
// browser actually started — without it, an attacker could trick an admin into
// completing an OAuth flow for the attacker's own cloud storage account, silently
// redirecting future backups to it (an OAuth account-linking CSRF).
export async function GET(_: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  const res = await apiFetch(`/backup/${provider}/authorize-url`);
  const payload = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: { authorizeUrl?: string; state?: string } }
    | null;

  if (!res.ok || !payload?.data?.authorizeUrl || !payload.data.state) {
    return NextResponse.json(
      { success: false, error: { message: "Unable to start the connection" } },
      { status: res.status === 200 ? 502 : res.status },
    );
  }

  const response = NextResponse.json({ success: true, data: { authorizeUrl: payload.data.authorizeUrl } });
  response.cookies.set(`epe_backup_oauth_state_${provider}`, payload.data.state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
