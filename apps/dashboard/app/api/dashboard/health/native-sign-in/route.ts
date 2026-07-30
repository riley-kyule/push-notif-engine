import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

async function proxy(path: string, init?: RequestInit): Promise<Response> {
  const response = await apiFetch(path, init);
  const payload = await response.json().catch(() => ({
    success: false,
    error: { message: "Invalid API response" },
  }));
  return NextResponse.json(payload, { status: response.status });
}

export async function GET(): Promise<Response> {
  return proxy("/auth/settings/native-sign-in");
}

export async function PATCH(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { enabled?: boolean } | null;
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { success: false, error: { message: "enabled must be a boolean" } },
      { status: 400 },
    );
  }

  return proxy("/auth/settings/native-sign-in", {
    method: "PATCH",
    body: JSON.stringify({ enabled: body.enabled }),
  });
}
