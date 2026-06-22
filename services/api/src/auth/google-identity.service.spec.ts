import assert from "node:assert/strict";
import test from "node:test";

import { GoogleIdentityService } from "./google-identity.service";

test("google identity service verifies and normalizes a tokeninfo payload", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  try {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          aud: "google-client-id",
          sub: "google-subject-123",
          email: "admin@example.com",
          email_verified: "true",
          iss: "accounts.google.com",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    const service = new GoogleIdentityService();
    const profile = await service.verifyIdToken("id-token");

    assert.equal(profile.subject, "google-subject-123");
    assert.equal(profile.email, "admin@example.com");
    assert.equal(profile.emailVerified, true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GOOGLE_OAUTH_CLIENT_ID = originalClientId;
  }
});

test("google identity service rejects an audience mismatch", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  try {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          aud: "different-client-id",
          sub: "google-subject-123",
          email: "admin@example.com",
          email_verified: true,
          iss: "https://accounts.google.com",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    const service = new GoogleIdentityService();
    await assert.rejects(async () => service.verifyIdToken("id-token"), /Google token audience mismatch/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GOOGLE_OAUTH_CLIENT_ID = originalClientId;
  }
});
