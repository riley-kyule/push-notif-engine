import { NextResponse } from "next/server";

import { apiFetch } from "../../../../lib/server-api";

export async function GET(): Promise<Response> {
  const res = await apiFetch("/sites");
  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    name: string;
    url: string;
    country: string;
    language: string;
    platform: string;
    status?: "active" | "inactive";
    vapidPublicKey?: string | null;
    appName: string;
    iconUrl: string;
    themeColor: string;
    optInPromptType: "lightbox-1" | "lightbox-2" | "bell-icon";
    optInPromptAnimation: "slide-in" | "fade-in" | "pop";
    optInPromptBackgroundColor: string;
    optInPromptHeadline: string;
    optInPromptHeadlineTextColor: string;
    optInPromptText: string;
    optInPromptTextColor: string;
    optInPromptIconUrl: string;
    optInPromptCancelButtonLabel: string;
    optInPromptCancelButtonTextColor: string;
    optInPromptCancelButtonBackgroundColor: string;
    optInPromptApproveButtonLabel: string;
    optInPromptApproveButtonTextColor: string;
    optInPromptApproveButtonBackgroundColor: string;
    optInPromptRepromptDelayDays: number;
    optInPromptRecentNotificationsLimit: number;
  };

  const res = await apiFetch("/sites", {
    method: "POST",
    body: JSON.stringify({
      name: body.name,
      url: body.url,
      country: body.country,
      language: body.language,
      platform: body.platform,
      status: body.status,
      vapidPublicKey: body.vapidPublicKey ?? null,
      appName: body.appName,
      iconUrl: body.iconUrl,
      themeColor: body.themeColor,
      optInPromptType: body.optInPromptType,
      optInPromptAnimation: body.optInPromptAnimation,
      optInPromptBackgroundColor: body.optInPromptBackgroundColor,
      optInPromptHeadline: body.optInPromptHeadline,
      optInPromptHeadlineTextColor: body.optInPromptHeadlineTextColor,
      optInPromptText: body.optInPromptText,
      optInPromptTextColor: body.optInPromptTextColor,
      optInPromptIconUrl: body.optInPromptIconUrl,
      optInPromptCancelButtonLabel: body.optInPromptCancelButtonLabel,
      optInPromptCancelButtonTextColor: body.optInPromptCancelButtonTextColor,
      optInPromptCancelButtonBackgroundColor: body.optInPromptCancelButtonBackgroundColor,
      optInPromptApproveButtonLabel: body.optInPromptApproveButtonLabel,
      optInPromptApproveButtonTextColor: body.optInPromptApproveButtonTextColor,
      optInPromptApproveButtonBackgroundColor: body.optInPromptApproveButtonBackgroundColor,
      optInPromptRepromptDelayDays: body.optInPromptRepromptDelayDays,
      optInPromptRecentNotificationsLimit: body.optInPromptRecentNotificationsLimit,
    }),
  });

  const data = await res.json().catch(() => ({ success: false, error: { message: "Invalid API response" } }));
  return NextResponse.json(data, { status: res.status });
}
