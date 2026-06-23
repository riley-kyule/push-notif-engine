import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const search = new URL(request.url).search;
  const res = await apiFetch(`/sites/${id}/mobile-devices${search}`);
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
