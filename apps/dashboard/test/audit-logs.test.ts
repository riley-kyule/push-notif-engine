import assert from "node:assert/strict";
import test from "node:test";

import { describeAction, flattenMetadata, getCategoryLabel, getTargetTypeLabel } from "../app/_data/audit-logs";

test("flattenMetadata turns a flat object into readable label/value rows, no JSON syntax", () => {
  const rows = flattenMetadata({ siteId: "site-1", name: "Example News", optInPromptType: "lightbox-1" });
  assert.deepEqual(rows, [
    { label: "Site id", value: "site-1" },
    { label: "Name", value: "Example News" },
    { label: "Opt in prompt type", value: "lightbox-1" },
  ]);
});

test("flattenMetadata flattens nested objects (e.g. the generic 'changes' update payload) with a path label", () => {
  const rows = flattenMetadata({ changes: { name: "New Name", status: "active" } });
  assert.deepEqual(rows, [
    { label: "Changes → Name", value: "New Name" },
    { label: "Changes → Status", value: "active" },
  ]);
});

test("flattenMetadata renders null/undefined/empty as an em dash, booleans as Yes/No, arrays joined", () => {
  const rows = flattenMetadata({ deletedAt: null, isActive: true, tags: ["a", "b"] });
  assert.deepEqual(rows, [
    { label: "Deleted at", value: "—" },
    { label: "Is active", value: "Yes" },
    { label: "Tags", value: "a, b" },
  ]);
});

test("describeAction reads as a natural sentence for a known action, and degrades gracefully for an unknown one", () => {
  assert.equal(
    describeAction({ action: "site.created", actorName: "Admin User", actorEmail: "admin@example.com" }),
    "Admin User created a site",
  );
  assert.equal(
    describeAction({ action: "some.unmapped.action", actorName: null, actorEmail: "ops@example.com" }),
    "ops@example.com some unmapped action",
  );
});

test("getCategoryLabel and getTargetTypeLabel produce human labels", () => {
  assert.equal(getCategoryLabel("access_control"), "Users & Roles");
  assert.equal(getCategoryLabel("unmapped_category"), "unmapped category");
  assert.equal(getTargetTypeLabel("site"), "Sites");
  assert.equal(getTargetTypeLabel(null), "—");
});
