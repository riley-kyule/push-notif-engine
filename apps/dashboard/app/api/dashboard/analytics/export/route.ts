import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../lib/server-api";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const search = url.search;
  const res = await apiFetch(`/analytics/export${search}`);
  const csv = await res.text().catch(() => "metric,value");

  return new NextResponse(csv, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "content-disposition": res.headers.get("content-disposition") ?? 'attachment; filename="analytics.csv"',
    },
  });
}
