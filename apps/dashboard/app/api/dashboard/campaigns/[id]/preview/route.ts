import { NextResponse } from "next/server";

import { getCampaign } from "../../../_store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      campaignId: campaign.id,
      preview: campaign.buttons,
      title: campaign.title,
      message: campaign.message,
      url: campaign.url,
      imageUrl: campaign.imageUrl,
      iconUrl: campaign.iconUrl,
    },
  });
}
