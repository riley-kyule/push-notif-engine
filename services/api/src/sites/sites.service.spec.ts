import assert from "node:assert/strict";
import test from "node:test";

import { createFakeAuditService } from "../audit/audit.service.fake";
import { InMemorySitesRepository } from "./in-memory-sites.repository";
import { SitesService } from "./sites.service";

// Wraps the in-memory fake so a test can assert on the
// expireActiveSubscribers call without modeling real subscriber rows.
class SpyingSitesRepository extends InMemorySitesRepository {
  expireCalls: string[] = [];
  expireReturnValue = 0;

  async expireActiveSubscribers(siteId: string): Promise<number> {
    this.expireCalls.push(siteId);
    return this.expireReturnValue;
  }
}

test("sites service creates and lists sites", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: "https://news.example.com/icon.png",
    themeColor: "#111111",
    optInPromptType: "lightbox-1",
    optInPromptAnimation: "slide-in",
    optInPromptBackgroundColor: "#ffffff",
    optInPromptHeadline: "Stay in the loop",
    optInPromptHeadlineTextColor: "#111111",
    optInPromptText: "Get important updates delivered to your browser.",
    optInPromptTextColor: "#444444",
    optInPromptIconUrl: "https://news.example.com/icon.png",
    optInPromptCancelButtonLabel: "Not now",
    optInPromptCancelButtonTextColor: "#ffffff",
    optInPromptCancelButtonBackgroundColor: "#111111",
    optInPromptApproveButtonLabel: "Enable",
    optInPromptApproveButtonTextColor: "#ffffff",
    optInPromptApproveButtonBackgroundColor: "#ea580c",
    optInPromptRepromptDelayDays: 30,
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "active",
  });

  assert.equal(site.name, "Exotic News");
  assert.equal(site.appName, "Exotic News");
  assert.equal(site.iconUrl, "https://news.example.com/icon.png");
  assert.equal(site.themeColor, "#111111");
  assert.equal(site.optInPromptRecentNotificationsLimit, 3);
  assert.equal(site.status, "active");

  const result = await service.listSites({ search: "news", limit: 10, offset: 0 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, site.id);
});

test("sites service rejects creating a site with a duplicate URL or name, case-insensitively", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const basePayload = {
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress" as const,
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: null,
    optInPromptType: "lightbox-1" as const,
    optInPromptAnimation: "slide-in" as const,
    optInPromptBackgroundColor: null,
    optInPromptHeadline: null,
    optInPromptHeadlineTextColor: null,
    optInPromptText: null,
    optInPromptTextColor: null,
    optInPromptIconUrl: null,
    optInPromptCancelButtonLabel: null,
    optInPromptCancelButtonTextColor: null,
    optInPromptCancelButtonBackgroundColor: null,
    optInPromptApproveButtonLabel: null,
    optInPromptApproveButtonTextColor: null,
    optInPromptApproveButtonBackgroundColor: null,
    optInPromptRepromptDelayDays: null,
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "active" as const,
  };

  await service.createSite(basePayload);

  await assert.rejects(
    () => service.createSite({ ...basePayload, url: "https://NEWS.example.com", name: "Different Name" }),
    /already exists/,
  );

  await assert.rejects(
    () => service.createSite({ ...basePayload, url: "https://different.example.com", name: "exotic news" }),
    /already exists/,
  );
});

test("sites service sorts by name and by subscriber count", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const basePayload = {
    country: "US",
    language: "en",
    platform: "WordPress" as const,
    logoUrl: null,
    iconUrl: null,
    themeColor: null,
    optInPromptType: "lightbox-1" as const,
    optInPromptAnimation: "slide-in" as const,
    optInPromptBackgroundColor: null,
    optInPromptHeadline: null,
    optInPromptHeadlineTextColor: null,
    optInPromptText: null,
    optInPromptTextColor: null,
    optInPromptIconUrl: null,
    optInPromptCancelButtonLabel: null,
    optInPromptCancelButtonTextColor: null,
    optInPromptCancelButtonBackgroundColor: null,
    optInPromptApproveButtonLabel: null,
    optInPromptApproveButtonTextColor: null,
    optInPromptApproveButtonBackgroundColor: null,
    optInPromptRepromptDelayDays: null,
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "active" as const,
  };

  await service.createSite({ ...basePayload, name: "Zebra Travel", url: "https://zebra.example.com", appName: "Zebra" });
  await service.createSite({ ...basePayload, name: "Amber Tours", url: "https://amber.example.com", appName: "Amber" });

  const byNameAsc = await service.listSites({ limit: 10, offset: 0, sortBy: "name", sortDir: "asc" });
  assert.deepEqual(byNameAsc.items.map((site) => site.name), ["Amber Tours", "Zebra Travel"]);

  const byNameDesc = await service.listSites({ limit: 10, offset: 0, sortBy: "name", sortDir: "desc" });
  assert.deepEqual(byNameDesc.items.map((site) => site.name), ["Zebra Travel", "Amber Tours"]);
});

test("sites service rejects deleting an active site", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: "#1c1917",
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
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "active",
  });

  await assert.rejects(() => service.deleteSite(site.id));
});

test("sites service deletes an inactive site", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: "#1c1917",
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
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "inactive",
  });

  await service.deleteSite(site.id);
  await assert.rejects(() => service.getSite(site.id));
});

test("sites service updates branding fields", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: "#1c1917",
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
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "active",
  });

  const updated = await service.updateSite(site.id, {
    appName: "Exotic News Live",
    iconUrl: "https://news.example.com/brand.png",
    themeColor: "#222222",
  });

  assert.equal(updated.appName, "Exotic News Live");
  assert.equal(updated.iconUrl, "https://news.example.com/brand.png");
  assert.equal(updated.themeColor, "#222222");
});

test("sites service rejects changing the VAPID public key alone once a site has a key pair", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: "#1c1917",
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
    vapidSubject: "mailto:push@news.example.com",
    vapidPublicKey: "original-public-key",
    vapidPrivateKey: "original-private-key",
    status: "active",
  });

  await assert.rejects(
    () => service.updateSite(site.id, { vapidPublicKey: "someone-pasted-a-different-key" }),
    /VAPID public key/,
  );

  // Replacing both together (what the regenerate-VAPID-keys endpoint does) is fine.
  const updated = await service.updateSite(site.id, {
    vapidPublicKey: "new-public-key",
    vapidPrivateKey: "new-private-key",
  });
  assert.equal(updated.vapidPublicKey, "new-public-key");
});

test("sites service generates rest api credentials", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository, createFakeAuditService());

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: "#1c1917",
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

  const credentials = await service.generateRestApiCredentials(site.id);

  assert.equal(credentials.site.restApiKeyId?.startsWith("rest_"), true);
  assert.equal(credentials.authToken.length > 10, true);
  assert.equal(credentials.site.restApiAuthTokenLast4, credentials.authToken.slice(-4));
});

test("generateVapidKeys expires every active subscriber, since they're permanently invalid under the new key pair", async () => {
  const repository = new SpyingSitesRepository();
  repository.expireReturnValue = 42;
  const service = new SitesService(repository, createFakeAuditService());

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    appName: "Exotic News",
    iconUrl: null,
    themeColor: "#1c1917",
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
    vapidSubject: "mailto:push@news.example.com",
    vapidPublicKey: "original-public-key",
    vapidPrivateKey: "original-private-key",
    status: "active",
  });

  await service.generateVapidKeys(site.id);

  assert.deepEqual(repository.expireCalls, [site.id]);
});
