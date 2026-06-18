import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const res = await apiFetch(`/sites/${id}`);
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = (await request.json()) as Partial<{
    name: string;
    url: string;
    country: string;
    language: string;
    platform: string;
    status: "active" | "inactive";
    vapidPublicKey: string | null;
  }>;

  const res = await apiFetch(`/sites/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: body.name,
      url: body.url,
      country: body.country,
      language: body.language,
      platform: body.platform,
      status: body.status,
      vapidPublicKey: body.vapidPublicKey,
    }),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(): Promise<Response> {
  return NextResponse.json(
    { success: false, error: { message: "Site deletion is not supported by the API" } },
    { status: 405 },
  );
}
