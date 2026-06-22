import assert from "node:assert/strict";
import test from "node:test";

import { dashboardNavigationSections } from "../app/_components/dashboard-shell";

test("dashboard sidebar includes the full product surface", () => {
  const sectionLabels = dashboardNavigationSections.map((section) => section.label);
  const itemLabels = dashboardNavigationSections.flatMap((section) => section.items.map((item) => item.label));

  assert.deepEqual(sectionLabels, ["Core", "Publishing", "Automation", "Integrations", "Reporting", "Platform"]);
  assert.ok(itemLabels.includes("Overview"));
  assert.ok(itemLabels.includes("Analytics"));
  assert.ok(itemLabels.includes("Subscribers"));
  assert.ok(itemLabels.includes("Sites"));
  assert.ok(itemLabels.includes("Add Site"));
  assert.ok(itemLabels.includes("Campaigns"));
  assert.ok(itemLabels.includes("Create Campaign"));
  assert.ok(itemLabels.includes("Taxonomies"));
  assert.ok(itemLabels.includes("Workflow & RSS"));
  assert.ok(itemLabels.includes("Browser Push"));
  assert.ok(itemLabels.includes("WordPress Plugin"));
  assert.ok(itemLabels.includes("Country Performance"));
  assert.ok(itemLabels.includes("Content Performance"));
  assert.ok(itemLabels.includes("Auth"));
  assert.ok(itemLabels.includes("Platform Health"));
  assert.ok(itemLabels.includes("Backup Config"));
  assert.ok(itemLabels.includes("RBAC"));
  assert.ok(itemLabels.includes("Deployment"));
});

test("dashboard sidebar has no two items pointing at the exact same href", () => {
  const hrefs = dashboardNavigationSections
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href): href is string => Boolean(href));

  assert.deepEqual(hrefs, Array.from(new Set(hrefs)));
});
