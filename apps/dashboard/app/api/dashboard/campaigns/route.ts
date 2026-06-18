import { NextResponse } from "next/server";

import { createCampaign, listCampaigns } from "../_store";

export async function GET(): Promise<Response> {
  const items = listCampaigns();
  return NextResponse.json({ success: true, data: { items, total: items.length } });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    siteId: string;
    name: string;
    channel: "web" | "mobile" | "all";
    type: "instant" | "scheduled" | "recurring";
    title: string;
    message: string;
    url: string;
    imageUrl: string | null;
    iconUrl: string | null;
    buttons: Array<{ label: string; url: string }>;
    expirationAt: string | null;
    status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "expired";
    scheduledAt: string | null;
    timezone: string | null;
    recurrenceType: "daily" | "weekly" | "monthly" | null;
    recurrenceInterval: number | null;
    recurrenceUntilAt: string | null;
    clonedFromCampaignId: string | null;
    sentAt: string | null;
  };

  const campaign = createCampaign(body);
  return NextResponse.json({ success: true, data: campaign }, { status: 201 });
}
