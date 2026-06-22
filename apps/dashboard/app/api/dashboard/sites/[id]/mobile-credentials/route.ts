import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/sites/${id}/mobile-credentials`);
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await request.text();
  const res = await apiFetch(`/sites/${id}/mobile-credentials`, {
    method: "PUT",
    body,
  });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
