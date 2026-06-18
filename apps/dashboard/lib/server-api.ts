import { cookies } from "next/headers";

export function getApiBase(): string {
  return process.env.DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("epe_access_token")?.value;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  return fetch(`${getApiBase()}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await apiFetch(path, init);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
