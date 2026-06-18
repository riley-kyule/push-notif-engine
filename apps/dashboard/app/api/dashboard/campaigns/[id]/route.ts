import { NextResponse } from "next/server";

import { deleteCampaign, getCampaign, updateCampaign } from "../../_store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: campaign });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await request.json();
  const campaign = updateCampaign(id, body);
  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: campaign });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const deleted = deleteCampaign(id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { deleted: true } });
}
