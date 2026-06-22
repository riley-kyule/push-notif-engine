import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

export async function PATCH(request: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  const body = await request.text();
  const res = await apiFetch(`/backup/${provider}/schedule`, { method: "PATCH", body });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
