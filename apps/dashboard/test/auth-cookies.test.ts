import assert from "node:assert/strict";
import test from "node:test";

import { NextResponse } from "next/server";

import { attachAuthCookies } from "../lib/auth-cookies";

test("attachAuthCookies sets access and refresh cookies", () => {
  const response = NextResponse.json({ success: true });

  attachAuthCookies(response, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });

  const cookies = response.cookies.getAll();
  const access = cookies.find((cookie) => cookie.name === "epe_access_token");
  const refresh = cookies.find((cookie) => cookie.name === "epe_refresh_token");

  assert.equal(access?.value, "access-token");
  assert.equal(refresh?.value, "refresh-token");
});
