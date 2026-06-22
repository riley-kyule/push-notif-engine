import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function DELETE(_: Request, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const { provider } = await params;
  const res = await apiFetch(`/backup/${provider}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
