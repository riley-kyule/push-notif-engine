import { cookies } from "next/headers";

export function getApiBase(): string {
  return process.env.DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
}

export function getApiTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.DASHBOARD_API_TIMEOUT_MS ?? "5000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

export async function getAuthToken(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("epe_access_token")?.value;
  } catch {
    return undefined;
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
  timeoutMsOverride?: number,
): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutMs = timeoutMsOverride ?? getApiTimeoutMs();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      const abortFromParent = () => controller.abort();
      init.signal.addEventListener("abort", abortFromParent, { once: true });
      controller.signal.addEventListener(
        "abort",
        () => {
          init.signal?.removeEventListener("abort", abortFromParent);
        },
        { once: true },
      );
    }
  }

  try {
    return await fetchImpl(`${getApiBase()}${path}`, {
      ...init,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
  timeoutMsOverride?: number,
): Promise<T | null> {
  try {
    const res = await apiFetch(path, init, fetchImpl, timeoutMsOverride);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
