import { NextResponse } from "next/server";

import { apiFetch } from "../../../../../../lib/server-api";

interface SiteApiResponse {
  success?: boolean;
  data?: { url?: string };
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;

  const siteRes = await apiFetch(`/sites/${id}`);
  const sitePayload = (await siteRes.json().catch(() => null)) as SiteApiResponse | null;
  const siteUrl = sitePayload?.data?.url;

  if (!siteRes.ok || !siteUrl) {
    return NextResponse.json(
      { success: false, error: { message: "Could not load this site's URL from EPE." } },
      { status: 502 },
    );
  }

  let html: string;
  try {
    const pageRes = await fetch(siteUrl, { signal: AbortSignal.timeout(8000) });
    html = await pageRes.text();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: `Could not reach ${siteUrl}.` } },
      { status: 502 },
    );
  }

  // A real check: fetch the site's actual homepage and look for the plugin's
  // own config object, scoped to this site's id so a copy-pasted snippet
  // pointing at a different site doesn't produce a false positive. Earlier
  // versions of this check only verified that the EPE API could respond for
  // this site id, which is trivially true for any active site regardless of
  // whether the plugin is installed anywhere -- this is why it falsely
  // reported "reachable" even for sites with no plugin at all.
  const pluginDetected = html.includes("ExoticPushEngineConfig") && html.includes(id);

  if (!pluginDetected) {
    return NextResponse.json(
      { success: false, error: { message: "Plugin script not found on the site's homepage." } },
      { status: 404 },
    );
  }

  // Detected for real -- record the connection via the same path the plugin's
  // own periodic request uses, so the timestamp logic stays in one place.
  await apiFetch(`/sites/public/${id}`);

  return NextResponse.json({ success: true });
}
