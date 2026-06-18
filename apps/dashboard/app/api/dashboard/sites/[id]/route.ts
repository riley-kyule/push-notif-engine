import { NextResponse } from "next/server";

import { deleteSite, getSite, updateSite } from "../../_store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const site = getSite(id);
  if (!site) {
    return NextResponse.json({ success: false, error: { message: "Site not found" } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: site });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = (await request.json()) as Partial<{
    name: string;
    url: string;
    country: string;
    language: string;
    status: "active" | "inactive";
    platform: string;
    subscribers: number;
    vapidPublicKey: string | null;
  }>;

  const site = updateSite(id, body);
  if (!site) {
    return NextResponse.json({ success: false, error: { message: "Site not found" } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: site });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const deleted = deleteSite(id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: { message: "Site not found" } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { deleted: true } });
}
