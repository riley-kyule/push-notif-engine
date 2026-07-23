import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { action?: "minor-update" | "core-update" } | null;
  if (!body) {
    return NextResponse.json(
      { success: false, error: { message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  // Docker mode only places an allowlisted request in the host agent's inbox;
  // the dashboard follows progress through /deployment/status while containers
  // are rebuilt and restarted. PM2 fallback still executes synchronously.
  const res = await apiFetch(
    "/health/deployment",
    {
      method: "POST",
      body: JSON.stringify({ action: body.action }),
    },
    fetch,
    21 * 60 * 1000,
  );
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
