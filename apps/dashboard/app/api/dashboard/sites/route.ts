import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/server-api";

export async function GET(): Promise<Response> {
  const res = await apiFetch("/sites");
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    name: string;
    url: string;
    country: string;
    language: string;
    platform: string;
    status?: "active" | "inactive";
    vapidPublicKey?: string | null;
  };

  const res = await apiFetch("/sites", {
    method: "POST",
    body: JSON.stringify({
      name: body.name,
      url: body.url,
      country: body.country,
      language: body.language,
      platform: body.platform,
      status: body.status,
      vapidPublicKey: body.vapidPublicKey ?? null,
    }),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
