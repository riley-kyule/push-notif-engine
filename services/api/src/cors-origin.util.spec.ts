import assert from "node:assert/strict";
import test from "node:test";

import { createOriginAllowlistChecker } from "./cors-origin.util";

test("createOriginAllowlistChecker allows an origin matching a registered site url", async () => {
  const isAllowed = createOriginAllowlistChecker(
    { listSiteUrls: async () => ["https://www.exotic-africa.com", "https://www.exotickenya.com"] },
    [],
  );

  assert.equal(await isAllowed("https://www.exotic-africa.com"), true);
  assert.equal(await isAllowed("https://www.exoticnigeria.com"), false);
});

test("createOriginAllowlistChecker always honors the static allowlist", async () => {
  const isAllowed = createOriginAllowlistChecker(
    { listSiteUrls: async () => [] },
    ["http://127.0.0.1:3000"],
  );

  assert.equal(await isAllowed("http://127.0.0.1:3000"), true);
});

test("createOriginAllowlistChecker rejects malformed origins", async () => {
  const isAllowed = createOriginAllowlistChecker({ listSiteUrls: async () => ["https://www.exotic-africa.com"] }, []);

  assert.equal(await isAllowed("not-a-url"), false);
});

test("createOriginAllowlistChecker caches site urls instead of querying on every call", async () => {
  let callCount = 0;
  const isAllowed = createOriginAllowlistChecker(
    {
      listSiteUrls: async () => {
        callCount += 1;
        return ["https://www.exotic-africa.com"];
      },
    },
    [],
    60_000,
  );

  await isAllowed("https://www.exotic-africa.com");
  await isAllowed("https://www.exotic-africa.com");
  await isAllowed("https://www.exotic-africa.com");

  assert.equal(callCount, 1);
});

test("createOriginAllowlistChecker refreshes the cache once it expires", async () => {
  let callCount = 0;
  const isAllowed = createOriginAllowlistChecker(
    {
      listSiteUrls: async () => {
        callCount += 1;
        return ["https://www.exotic-africa.com"];
      },
    },
    [],
    0,
  );

  await isAllowed("https://www.exotic-africa.com");
  await isAllowed("https://www.exotic-africa.com");

  assert.equal(callCount, 2);
});
