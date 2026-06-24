import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { siteId?: string } | null;
  if (!body?.siteId) {
    return NextResponse.json(
      { success: false, error: { message: "siteId is required." } },
      { status: 400 },
    );
  }

  const res = await apiFetch("/automations/seed-defaults", {
    method: "POST",
    body: JSON.stringify({ siteId: body.siteId }),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
