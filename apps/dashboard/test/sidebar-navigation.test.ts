import assert from "node:assert/strict";
import test from "node:test";

import { dashboardNavigationSections } from "../app/_components/dashboard-shell";

test("dashboard sidebar stays pruned to real, navigable destinations with plain-language labels", () => {
  const sectionLabels = dashboardNavigationSections.map((section) => section.label);
  const itemLabels = dashboardNavigationSections.flatMap((section) => section.items.map((item) => item.label));

  assert.deepEqual(sectionLabels, ["Dashboard", "Sites & Campaigns", "Automation", "System"]);
  assert.ok(itemLabels.includes("Overview"));
  assert.ok(itemLabels.includes("Analytics"));
  assert.ok(itemLabels.includes("Subscribers"));
  assert.ok(itemLabels.includes("Sites"));
  assert.ok(itemLabels.includes("Campaigns"));
  assert.ok(itemLabels.includes("Categories"));
  assert.ok(itemLabels.includes("Audience Groups"));
  assert.ok(itemLabels.includes("Automations"));
  assert.ok(itemLabels.includes("Activity Log"));
  assert.ok(itemLabels.includes("Users & Roles"));
  assert.ok(itemLabels.includes("System Health"));
  assert.ok(itemLabels.includes("Backups"));

  // Every item must link somewhere real — no roadmap/placeholder entries that go nowhere.
  for (const section of dashboardNavigationSections) {
    for (const item of section.items) {
      assert.ok(item.href, `${item.label} should have a real destination`);
    }
  }
});

test("dashboard sidebar has no two items pointing at the exact same href", () => {
  const hrefs = dashboardNavigationSections
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href): href is string => Boolean(href));

  assert.deepEqual(hrefs, Array.from(new Set(hrefs)));
});
