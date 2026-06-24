import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { success: false, error: { message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const res = await apiFetch(`/automations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/automations/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
