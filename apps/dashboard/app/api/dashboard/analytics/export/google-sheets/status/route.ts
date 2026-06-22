import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../../lib/server-api";

export async function GET(): Promise<Response> {
  const res = await apiFetch("/analytics/export/google-sheets/status");
  const payload = (await res.json().catch(() => null)) as { success?: boolean; data?: { configured?: boolean } } | null;

  return NextResponse.json({ success: true, data: { configured: Boolean(payload?.data?.configured) } });
}
