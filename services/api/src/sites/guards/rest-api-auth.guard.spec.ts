import assert from "node:assert/strict";
import test from "node:test";

import { RestApiAuthGuard } from "./rest-api-auth.guard";

test("rest api auth guard attaches the authenticated site to the request", async () => {
  const guard = new RestApiAuthGuard({
    async authenticate(siteId: string, siteKeyId: string, authToken: string) {
      return {
        id: siteId,
        name: "Exotic News",
        restApiKeyId: siteKeyId,
        restApiAuthTokenLast4: authToken.slice(-4),
      };
    },
  } as never);

  const request: { headers: Record<string, string>; params: { siteId: string }; site?: { id: string } } = {
    headers: {
      "x-epe-site-key": "rest_123",
      authorization: "Bearer token-123",
    },
    params: { siteId: "site-1" },
  };

  const allowed = await guard.canActivate({
    switchToHttp: () =>
      ({
        getRequest: () => request,
      }) as never,
  } as never);

  assert.equal(allowed, true);
  assert.equal(request.site?.id, "site-1");
});
