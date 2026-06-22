import { apiFetch } from "../../../../../lib/server-api";

export async function GET() {
  const res = await apiFetch("/health/platform");
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
