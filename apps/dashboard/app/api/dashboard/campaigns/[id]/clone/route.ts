import { NextResponse } from "next/server";

import { cloneCampaign } from "../../../_store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const campaign = cloneCampaign(id, body.name);
  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: campaign }, { status: 201 });
}
