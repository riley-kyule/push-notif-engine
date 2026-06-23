import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function PATCH(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const res = await apiFetch("/mobile-devices/invalidate", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
