import { NextResponse } from "next/server";

import { apiFetch, getApiBase, getAuthToken } from "../../../../lib/server-api";

export async function GET(request: Request): Promise<Response> {
  const { search } = new URL(request.url);
  const res = await apiFetch(`/campaign-media${search}`);
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  const token = await getAuthToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiBase()}/campaign-media`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
