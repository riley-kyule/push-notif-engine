import assert from "node:assert/strict";
import test from "node:test";

import { RestApiController } from "./rest-api.controller";

test("rest api controller exposes site identity", async () => {
  const controller = new RestApiController();

  const response = await controller.identity({
    id: "site-1",
    name: "Exotic News",
    restApiKeyId: "rest_123",
    restApiAuthTokenLast4: "abcd",
  } as never);

  assert.equal(response.success, true);
  assert.equal(response.data.siteId, "site-1");
  assert.equal(response.data.keyId, "rest_123");
});
