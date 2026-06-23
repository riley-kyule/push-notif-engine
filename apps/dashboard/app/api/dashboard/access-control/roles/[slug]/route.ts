import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { slug } = await context.params;
  const body = await request.json();
  const res = await apiFetch(`/access-control/roles/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
