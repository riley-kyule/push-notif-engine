import { NextResponse } from "next/server";

import { createSite, listSites } from "../_store";

export async function GET(): Promise<Response> {
  return NextResponse.json({ success: true, data: { items: listSites(), total: listSites().length } });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    name: string;
    url: string;
    country: string;
    language: string;
    status: "active" | "inactive";
    platform: string;
    subscribers?: number;
    vapidPublicKey?: string | null;
  };

  const site = createSite(body);
  return NextResponse.json({ success: true, data: site }, { status: 201 });
}
