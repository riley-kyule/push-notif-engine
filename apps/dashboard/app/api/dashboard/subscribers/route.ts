import { NextResponse } from "next/server";

import { getSubscriberList } from "../../../_data/subscribers";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as "active" | "inactive" | "unsubscribed" | "expired" | null;
  const siteId = searchParams.get("siteId");

  const payload = await getSubscriberList({
    status: status ?? undefined,
    siteId: siteId ?? undefined,
  });
  return NextResponse.json({ success: true, data: payload });
}
