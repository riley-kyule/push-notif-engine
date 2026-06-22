import assert from "node:assert/strict";
import test from "node:test";

import { SitesController } from "./sites.controller";

test("sites controller can generate rest api credentials", async () => {
  const controller = new SitesController({
    async createSite() {
      throw new Error("unused");
    },
    async listSites() {
      throw new Error("unused");
    },
    async getSite() {
      throw new Error("unused");
    },
    async updateSite() {
      throw new Error("unused");
    },
    async generateVapidKeys() {
      throw new Error("unused");
    },
    async generateRestApiCredentials() {
      return {
        site: { id: "site-1", restApiKeyId: "rest_123", restApiAuthTokenLast4: "abcd" },
        authToken: "super-secret-token",
      };
    },
    async deleteSite() {
      throw new Error("unused");
    },
  } as never);

  const response = await controller.generateRestApiCredentials("site-1", { id: "user-1" } as never);

  assert.equal(response.success, true);
  assert.equal((response.data as { authToken?: string }).authToken, "super-secret-token");
});
