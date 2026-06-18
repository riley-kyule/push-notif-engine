import { NextResponse } from "next/server";

import { getSubscriberList } from "../../../_data/subscribers";

export async function GET(): Promise<Response> {
  const payload = await getSubscriberList();
  return NextResponse.json({ success: true, data: payload });
}
