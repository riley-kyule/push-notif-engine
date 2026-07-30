import assert from "node:assert/strict";
import test from "node:test";

import LoginPage from "../app/login/page";
import { googleClientIdFromEnvironment } from "../lib/google-auth-config";

test("login page exists", () => {
  assert.equal(typeof LoginPage, "function");
});

test("login page reads the Google client id at request time", () => {
  const previous = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = "runtime-google-client-id";

  try {
    assert.equal(googleClientIdFromEnvironment(), "runtime-google-client-id");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    else process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = previous;
  }
});
