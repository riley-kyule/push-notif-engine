import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;

  // Hits the exact same unauthenticated endpoint the WordPress plugin polls
  // (GET /sites/public/:id) -- a successful response means the plugin (or any
  // integration) really can reach the API right now, and records the
  // connection as a side effect on the backend.
  const res = await apiFetch(`/sites/public/${id}`);

  if (!res.ok) {
    return NextResponse.json(
      { success: false, error: { message: "Site is unreachable or not active." } },
      { status: res.status },
    );
  }

  return NextResponse.json({ success: true });
}
