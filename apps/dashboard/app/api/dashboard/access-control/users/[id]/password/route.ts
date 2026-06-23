import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../../lib/server-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const res = await apiFetch(`/access-control/users/${encodeURIComponent(id)}/password`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
