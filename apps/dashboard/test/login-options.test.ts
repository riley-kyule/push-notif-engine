import assert from "node:assert/strict";
import test from "node:test";

import { getLoginOptions } from "../lib/login-options";

test("login options load the persisted native sign-in setting", async () => {
  const options = await getLoginOptions(async () => new Response(JSON.stringify({
    success: true,
    data: {
      nativeSignInEnabled: false,
      nativeSignInForced: false,
      googleClientId: "google-client-id",
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));

  assert.deepEqual(options, {
    nativeSignInEnabled: false,
    nativeSignInForced: false,
    googleClientId: "google-client-id",
  });
});

test("login options fail open for native sign-in when the API is unavailable", async () => {
  const options = await getLoginOptions(async () => {
    throw new Error("API unavailable");
  });

  assert.deepEqual(options, {
    nativeSignInEnabled: true,
    nativeSignInForced: false,
    googleClientId: null,
  });
});
