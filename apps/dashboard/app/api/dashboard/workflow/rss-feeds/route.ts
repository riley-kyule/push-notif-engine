import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function GET(): Promise<Response> {
  const res = await apiFetch("/workflow/rss-feeds");
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const res = await apiFetch("/workflow/rss-feeds", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
