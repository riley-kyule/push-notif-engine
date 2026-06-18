import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySitesRepository } from "./in-memory-sites.repository";
import { SitesService } from "./sites.service";

test("sites service creates and lists sites", async () => {
  const repository = new InMemorySitesRepository();
  const service = new SitesService(repository);

  const site = await service.createSite({
    name: "Exotic News",
    url: "https://news.example.com",
    country: "US",
    language: "en",
    platform: "WordPress",
    logoUrl: null,
    vapidSubject: null,
    vapidPublicKey: null,
    vapidPrivateKey: null,
    status: "active",
  });

  assert.equal(site.name, "Exotic News");
  assert.equal(site.status, "active");

  const result = await service.listSites({ search: "news", limit: 10, offset: 0 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, site.id);
});
