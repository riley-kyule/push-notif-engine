import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { success: false, error: { message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const res = await apiFetch("/subscribers/clear-inactive", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
