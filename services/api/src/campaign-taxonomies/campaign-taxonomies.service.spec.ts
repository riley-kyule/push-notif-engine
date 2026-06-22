import assert from "node:assert/strict";
import test from "node:test";

import { createFakeAuditService } from "../audit/audit.service.fake";
import { CampaignTaxonomiesService } from "./campaign-taxonomies.service";
import { InMemoryContentTaxonomiesRepository } from "./in-memory-campaign-taxonomies.repository";

test("campaign taxonomies service creates, updates, lists, and deletes taxonomies", async () => {
  const repository = new InMemoryContentTaxonomiesRepository();
  const service = new CampaignTaxonomiesService(repository as never, createFakeAuditService());

  const created = await service.create({
    slug: "seasonal-offer",
    label: "Seasonal Offer",
    description: "Limited time campaigns",
    isActive: true,
    sortOrder: 15,
  });

  assert.equal(created.slug, "seasonal-offer");

  const updated = await service.update(created.id, {
    label: "Seasonal Promo",
    isActive: false,
  });

  assert.equal(updated.label, "Seasonal Promo");
  assert.equal(updated.isActive, false);

  const list = await service.list();
  assert.equal(list.total, 1);

  await service.delete(created.id);
  const afterDelete = await service.list();
  assert.equal(afterDelete.total, 0);
});

test("campaign taxonomies service validates active taxonomies", async () => {
  const repository = new InMemoryContentTaxonomiesRepository();
  const service = new CampaignTaxonomiesService(repository as never, createFakeAuditService());

  await service.create({
    slug: "announcement",
    label: "Announcement",
    description: null,
    isActive: true,
    sortOrder: 1,
  });

  await service.ensureActive("announcement");
  await assert.rejects(() => service.ensureActive("missing"));
});
