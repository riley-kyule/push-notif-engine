// Client-side fetch helper for the dashboard's own /api/dashboard/** BFF
// routes. Those routes forward the API's response body and status as-is
// (see app/api/dashboard/**/route.ts), and the API's global exception
// filter (services/api/src/common/http-exception.filter.ts) normalizes
// every error to { success: false, error: { message, statusCode } } --
// so this is the one place that needs to know that shape, instead of each
// form re-implementing its own slightly different error extraction.
export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  if (error && typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  // Defensive fallback in case something ever returns Nest's un-normalized
  // default shape ({ statusCode, message, error }) instead.
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message) && message.length > 0) {
    return message.join(" ");
  }
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return fallback;
}

export async function postJson<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { accept: "application/json", "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `Request failed with status ${response.status}`));
  }

  return payload as T;
}
