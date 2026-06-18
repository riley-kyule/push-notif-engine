import { getApiBase } from "./server-api";

export interface BrowserPushDispatchInput {
  siteId: string;
  title: string;
  body: string;
  url: string;
  icon?: string | null;
  image?: string | null;
  campaignId?: string | null;
}

export interface BrowserPushDispatchSuccess {
  ok: true;
  jobId: string | undefined;
  queued: true;
}

export interface BrowserPushDispatchFailure {
  ok: false;
  status: number;
  error: string;
}

export type BrowserPushDispatchResult = BrowserPushDispatchSuccess | BrowserPushDispatchFailure;

interface BrowserPushDispatchResponse {
  success?: boolean;
  data?: {
    jobId?: string;
    queued?: true;
  };
  error?: string;
  message?: string;
}

function extractErrorMessage(payload: BrowserPushDispatchResponse | null): string {
  return payload?.error ?? payload?.message ?? "Unable to dispatch browser push";
}

export async function dispatchBrowserPush(
  input: BrowserPushDispatchInput,
  options: {
    authorizationToken?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<BrowserPushDispatchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${getApiBase()}/browser-push/dispatch`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(options.authorizationToken ? { authorization: `Bearer ${options.authorizationToken}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as BrowserPushDispatchResponse | null;
      return {
        ok: false,
        status: response.status,
        error: extractErrorMessage(payload),
      };
    }

    const payload = (await response.json()) as BrowserPushDispatchResponse;
    return {
      ok: true,
      jobId: payload.data?.jobId,
      queued: payload.data?.queued ?? true,
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Cannot reach API server",
    };
  }
}
