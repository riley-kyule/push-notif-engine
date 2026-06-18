import { NextResponse } from "next/server";

import { getFallbackSubscriber } from "../../../../_data/subscribers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const subscriber = getFallbackSubscriber(id);

  if (!subscriber) {
    return NextResponse.json({ success: false, error: { message: "Subscriber not found" } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: subscriber });
}
