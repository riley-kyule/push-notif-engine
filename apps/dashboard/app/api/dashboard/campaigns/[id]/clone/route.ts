import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const res = await apiFetch(`/campaigns/${id}/clone`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
