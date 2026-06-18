import { NextResponse } from "next/server";

import { getFallbackSubscriberList } from "../../../_data/subscribers";

export async function GET(): Promise<Response> {
  const payload = getFallbackSubscriberList();
  return NextResponse.json({ success: true, data: payload });
}
