import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const res = await apiFetch("/mobile-push/dispatch", {
    method: "POST",
    body,
  });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
