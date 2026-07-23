import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

export async function GET(): Promise<Response> {
  const res = await apiFetch("/health/deployment/status");
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
