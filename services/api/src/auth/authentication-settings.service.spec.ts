import assert from "node:assert/strict";
import test from "node:test";

import { AuthenticationSettingsService } from "./authentication-settings.service";

test("authentication settings default native sign-in to enabled when no row exists", async () => {
  const service = new AuthenticationSettingsService(
    { async query() { return { rows: [] }; } } as never,
    { async log() { return undefined; } } as never,
  );

  assert.equal(await service.isNativeSignInEnabled(), true);
});

test("authentication settings expose the persisted login options", async () => {
  const previousClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
  const service = new AuthenticationSettingsService(
    { async query() { return { rows: [{ setting_value: false }] }; } } as never,
    { async log() { return undefined; } } as never,
  );

  try {
    assert.deepEqual(await service.getLoginOptions(), {
      nativeSignInEnabled: false,
      nativeSignInForced: false,
      googleClientId: "google-client-id",
    });
  } finally {
    if (previousClientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    else process.env.GOOGLE_OAUTH_CLIENT_ID = previousClientId;
  }
});

test("authentication settings persist and audit native sign-in changes", async () => {
  const previousClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const audits: Array<{ action: string; actorUserId?: string; metadata?: Record<string, unknown> }> = [];
  const service = new AuthenticationSettingsService(
    {
      async query(sql: string, params: unknown[]) {
        queries.push({ sql, params });
        return { rows: [] };
      },
    } as never,
    {
      async log(entry: { action: string; actorUserId?: string; metadata?: Record<string, unknown> }) {
        audits.push(entry);
      },
    } as never,
  );

  try {
    const result = await service.setNativeSignInEnabled(false, "user-1");
    assert.equal(result.nativeSignInEnabled, false);
    assert.equal(result.nativeSignInForced, false);
    assert.deepEqual(queries[0]?.params, ["auth.native_sign_in_enabled", "false"]);
    assert.equal(audits[0]?.action, "auth.native_sign_in_disabled");
    assert.equal(audits[0]?.actorUserId, "user-1");
    assert.deepEqual(audits[0]?.metadata, { enabled: false });
  } finally {
    if (previousClientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    else process.env.GOOGLE_OAUTH_CLIENT_ID = previousClientId;
  }
});

test("authentication settings refuse to disable the recovery login when Google is unavailable", async () => {
  const previousClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  const service = new AuthenticationSettingsService(
    { async query() { return { rows: [] }; } } as never,
    { async log() { return undefined; } } as never,
  );

  try {
    await assert.rejects(
      () => service.setNativeSignInEnabled(false, "user-1"),
      /Google Sign-In must be configured/i,
    );
  } finally {
    if (previousClientId !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = previousClientId;
  }
});

test("authentication settings honor the emergency native sign-in override", async () => {
  const previousOverride = process.env.EPE_FORCE_NATIVE_SIGN_IN;
  process.env.EPE_FORCE_NATIVE_SIGN_IN = "true";
  const service = new AuthenticationSettingsService(
    { async query() { throw new Error("database setting should not be read"); } } as never,
    { async log() { return undefined; } } as never,
  );

  try {
    assert.equal(await service.isNativeSignInEnabled(), true);
    await assert.rejects(
      () => service.setNativeSignInEnabled(false, "user-1"),
      /forced on by EPE_FORCE_NATIVE_SIGN_IN/i,
    );
  } finally {
    if (previousOverride === undefined) delete process.env.EPE_FORCE_NATIVE_SIGN_IN;
    else process.env.EPE_FORCE_NATIVE_SIGN_IN = previousOverride;
  }
});
