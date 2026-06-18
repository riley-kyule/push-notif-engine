import { NextResponse } from "next/server";

import { dispatchBrowserPush } from "../../../../../lib/browser-push-dispatch";
import { getAuthToken } from "../../../../../lib/server-api";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const input = body as {
    siteId?: string;
    title?: string;
    body?: string;
    url?: string;
    icon?: string | null;
    image?: string | null;
    campaignId?: string | null;
  };

  const authorizationToken = await getAuthToken();
  const result = await dispatchBrowserPush(
    {
      siteId: typeof input.siteId === "string" ? input.siteId : "",
      title: typeof input.title === "string" ? input.title : "",
      body: typeof input.body === "string" ? input.body : "",
      url: typeof input.url === "string" ? input.url : "",
      icon: typeof input.icon === "string" ? input.icon : input.icon ?? null,
      image: typeof input.image === "string" ? input.image : input.image ?? null,
      campaignId: typeof input.campaignId === "string" ? input.campaignId : input.campaignId ?? null,
    },
    authorizationToken ? { authorizationToken } : undefined,
  );

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    data: {
      jobId: result.jobId,
      queued: result.queued,
    },
  });
}
