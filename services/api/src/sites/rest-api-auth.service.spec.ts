import assert from "node:assert/strict";
import test from "node:test";

import { UnauthorizedException } from "@nestjs/common";

import { InMemorySitesRepository } from "./in-memory-sites.repository";
import { RestApiAuthService } from "./rest-api-auth.service";
import { SitesService } from "./sites.service";
import { createFakeAuditService } from "../audit/audit.service.fake";

async function createSiteWithCredentials() {
  const repository = new InMemorySitesRepository();
  const sitesService = new SitesService(repository, createFakeAuditService());
  const authService = new RestApiAuthService(repository);

  const site = await sitesService.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: "#111111",
    optInPromptType: "lightbox-1",
    optInPromptAnimation: "slide-in",
    optInPromptBackgroundColor: "#ffffff",
    optInPromptHeadline: "Stay in the loop",
    optInPromptHeadlineTextColor: "#111111",
    optInPromptText: "Get important updates delivered to your browser.",
    optInPromptTextColor: "#444444",
    optInPromptIconUrl: null,
    optInPromptCancelButtonLabel: "Not now",
    optInPromptCancelButtonTextColor: "#ffffff",
    optInPromptCancelButtonBackgroundColor: "#111111",
    optInPromptApproveButtonLabel: "Enable",
    optInPromptApproveButtonTextColor: "#ffffff",
    optInPromptApproveButtonBackgroundColor: "#ea580c",
    optInPromptRepromptDelayDays: 30,
    optInPromptRecentNotificationsLimit: 3,
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "active",
  });

  const credentials = await sitesService.generateRestApiCredentials(site.id);
  return { authService, credentials };
}

test("rest api auth service authenticates valid credentials", async () => {
  const { authService, credentials } = await createSiteWithCredentials();

  const authenticatedSite = await authService.authenticate(
    credentials.site.id,
    credentials.site.restApiKeyId ?? "",
    credentials.authToken,
  );

  assert.equal(authenticatedSite.id, credentials.site.id);
});

test("rest api auth service rejects invalid tokens", async () => {
  const { authService, credentials } = await createSiteWithCredentials();

  await assert.rejects(
    async () => {
      await authService.authenticate(credentials.site.id, credentials.site.restApiKeyId ?? "", "bad-token");
    },
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test("rest api auth service rejects invalid key ids", async () => {
  const { authService, credentials } = await createSiteWithCredentials();

  await assert.rejects(
    async () => {
      await authService.authenticate(credentials.site.id, "rest_wrong", credentials.authToken);
    },
    (error: unknown) => error instanceof UnauthorizedException,
  );
});
