import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function POST(): Promise<Response> {
  const res = await apiFetch("/browser-push/clear-all-delivery-history", { method: "POST" });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
