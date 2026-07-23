import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const response = await apiFetch("/segments", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: response.status });
}
