import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { siteId?: string | null } | null;

  const res = await apiFetch("/automations/seed-defaults", {
    method: "POST",
    body: JSON.stringify({ siteId: body?.siteId ?? null }),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
