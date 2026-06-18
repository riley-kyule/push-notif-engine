import { NextResponse } from "next/server";

import { scheduleCampaign } from "../../../_store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = (await request.json()) as {
    scheduledAt?: string | null;
    timezone?: string | null;
    recurrenceType?: "daily" | "weekly" | "monthly" | null;
    recurrenceInterval?: number | null;
    recurrenceUntilAt?: string | null;
  };

  const campaign = scheduleCampaign(id, body);
  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: campaign });
}
