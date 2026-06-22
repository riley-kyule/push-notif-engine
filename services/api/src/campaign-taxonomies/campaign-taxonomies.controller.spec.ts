import assert from "node:assert/strict";
import test from "node:test";

import { CampaignTaxonomiesController } from "./campaign-taxonomies.controller";

test("campaign taxonomies controller returns created taxonomy data", async () => {
  const controller = new CampaignTaxonomiesController({
    async list() {
      return { items: [], total: 0 };
    },
    async create() {
      return { id: "taxonomy-1", slug: "seasonal", label: "Seasonal", description: null, isActive: true, sortOrder: 10 };
    },
    async update() {
      return { id: "taxonomy-1", slug: "seasonal", label: "Seasonal", description: null, isActive: true, sortOrder: 10 };
    },
    async delete() {
      return undefined;
    },
  } as never);

  const response = await controller.create(
    { slug: "seasonal", label: "Seasonal", description: null, isActive: true, sortOrder: 10 } as never,
    { id: "user-1" } as never,
  );

  assert.equal(response.success, true);
  assert.equal((response.data as { slug?: string }).slug, "seasonal");
});
