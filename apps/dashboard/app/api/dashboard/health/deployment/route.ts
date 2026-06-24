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

  // The API's own exec timeout for a core update is 20 minutes (npm install +
  // two builds + migrate) -- the default BFF fetch timeout (5s) would abort
  // long before that, so this call needs its own, longer ceiling.
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
