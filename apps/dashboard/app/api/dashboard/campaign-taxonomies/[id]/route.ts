import { NextRequest, NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await request.json();
  const res = await apiFetch(`/campaign-taxonomies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/campaign-taxonomies/${id}`, {
    method: "DELETE",
  });

  const data = await res.json().catch(() => ({ success: true, data: { deleted: true } }));
  return NextResponse.json(data, { status: res.status });
}
