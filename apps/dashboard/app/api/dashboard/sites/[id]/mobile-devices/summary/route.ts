import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../../lib/server-api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/sites/${id}/mobile-devices/summary`);
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
