import assert from "node:assert/strict";
import test from "node:test";

import { apiJson, getApiTimeoutMs } from "../lib/server-api";

test("getApiTimeoutMs falls back to 5000ms when unset or invalid", () => {
  const originalValue = process.env.DASHBOARD_API_TIMEOUT_MS;
  try {
    delete process.env.DASHBOARD_API_TIMEOUT_MS;
    assert.equal(getApiTimeoutMs(), 5000);

    process.env.DASHBOARD_API_TIMEOUT_MS = "not-a-number";
    assert.equal(getApiTimeoutMs(), 5000);

    process.env.DASHBOARD_API_TIMEOUT_MS = "2500";
    assert.equal(getApiTimeoutMs(), 2500);
  } finally {
    process.env.DASHBOARD_API_TIMEOUT_MS = originalValue;
  }
});

test("apiJson returns null when the dashboard API request times out", async () => {
  const originalValue = process.env.DASHBOARD_API_TIMEOUT_MS;
  try {
    process.env.DASHBOARD_API_TIMEOUT_MS = "10";

    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        const abort = () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        };

        if (signal?.aborted) {
          abort();
          return;
        }

        signal?.addEventListener("abort", abort, { once: true });
      });
    }) as typeof fetch;

    const result = await apiJson("/health/platform", undefined, fetchImpl);
    assert.equal(result, null);
  } finally {
    process.env.DASHBOARD_API_TIMEOUT_MS = originalValue;
  }
});
