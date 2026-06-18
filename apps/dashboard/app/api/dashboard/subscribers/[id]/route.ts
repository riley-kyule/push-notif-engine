import { NextResponse } from "next/server";

import { getSubscriber } from "../../../../_data/subscribers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const subscriber = await getSubscriber(id);

  if (!subscriber) {
    return NextResponse.json({ success: false, error: { message: "Subscriber not found" } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: subscriber });
}
