import assert from "node:assert/strict";
import test from "node:test";

import { resolveCountryFromHeaders } from "./geo-ip.util";

test("resolveCountryFromHeaders reads a valid cf-ipcountry header", () => {
  assert.equal(resolveCountryFromHeaders({ "cf-ipcountry": "za" }), "ZA");
});

test("resolveCountryFromHeaders ignores Cloudflare's unknown-country sentinel", () => {
  assert.equal(resolveCountryFromHeaders({ "cf-ipcountry": "XX" }), undefined);
});

test("resolveCountryFromHeaders returns undefined when the header is absent", () => {
  assert.equal(resolveCountryFromHeaders({}), undefined);
  assert.equal(resolveCountryFromHeaders(undefined), undefined);
});

test("resolveCountryFromHeaders takes the first value when the header repeats", () => {
  assert.equal(resolveCountryFromHeaders({ "cf-ipcountry": ["ke", "ng"] }), "KE");
});
