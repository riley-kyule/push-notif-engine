import assert from "node:assert/strict";
import test from "node:test";

import { DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD, resolveLogin } from "../lib/auth-session";

test("resolveLogin falls back locally when the API server is unreachable in development", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFallback = process.env.DASHBOARD_ALLOW_LOCAL_AUTH_FALLBACK;
  try {
    process.env.NODE_ENV = "development";
    delete process.env.DASHBOARD_ALLOW_LOCAL_AUTH_FALLBACK;

    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };

    const result = await resolveLogin(
      {
        email: DEV_LOGIN_EMAIL,
        password: DEV_LOGIN_PASSWORD,
      },
      fetchImpl as typeof fetch,
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error("Expected a successful local fallback login");
    }

    assert.equal(result.source, "local-fallback");
    assert.match(result.tokens.accessToken, /^local-access-/);
    assert.match(result.tokens.refreshToken ?? "", /^local-refresh-/);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DASHBOARD_ALLOW_LOCAL_AUTH_FALLBACK = originalFallback;
  }
});

test("resolveLogin does not fall back for invalid credentials", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";

    const fetchImpl = async () => {
      throw new TypeError("fetch failed");
    };

    const result = await resolveLogin(
      {
        email: "someone@example.com",
        password: "wrong-password",
      },
      fetchImpl as typeof fetch,
    );

    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error("Expected API reach failure for invalid fallback credentials");
    }
    assert.equal(result.status, 502);
    assert.equal(result.error, "Cannot reach API server");
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});
