import assert from "node:assert/strict";
import test from "node:test";

import { AuditService } from "./audit.service";

test("audit service logs events and lists them in reverse chronological order", async () => {
  const queries: Array<{ sql: string; params: unknown[] | undefined }> = [];
  const pool = {
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params });

      if (sql.includes("COUNT(*)::text")) {
        return { rows: [{ count: "2" }] };
      }

      return {
        rows: [
          {
            id: "audit-2",
            actor_user_id: "user-1",
            actor_email: "admin@example.com",
            actor_name: "Admin User",
            actor_role: "admin",
            action: "auth.login.success",
            target_type: null,
            target_id: null,
            metadata: { email: "admin@example.com" },
            created_at: "2026-06-22T10:00:00.000Z",
            updated_at: "2026-06-22T10:00:00.000Z",
          },
        ],
      };
    },
  };

  const auditService = new AuditService(pool as never);

  await auditService.log({
    actorUserId: "user-1",
    action: "auth.login.success",
    metadata: { email: "admin@example.com" },
  });

  const page = await auditService.list({ limit: 25, offset: 0 });

  assert.equal(queries.length >= 2, true);
  assert.equal(page.total, 2);
  assert.equal(page.items[0]?.action, "auth.login.success");
  assert.equal(page.items[0]?.actorEmail, "admin@example.com");
});

test("audit service filters by category, role, actor, and date range", async () => {
  const queries: Array<{ sql: string; params: unknown[] | undefined }> = [];
  const pool = {
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
      if (sql.includes("COUNT(*)::text")) {
        return { rows: [{ count: "0" }] };
      }
      return { rows: [] };
    },
  };

  const auditService = new AuditService(pool as never);
  await auditService.list({
    category: "site",
    actorRole: "admin",
    actorUserId: "user-1",
    createdAfter: "2026-01-01T00:00:00.000Z",
    createdBefore: "2026-12-31T23:59:59.000Z",
    limit: 25,
    offset: 0,
  });

  const listQuery = queries.find((entry) => entry.sql.includes("LIMIT"));
  assert.ok(listQuery);
  assert.match(listQuery.sql, /a\.action LIKE \$1/);
  assert.match(listQuery.sql, /r\.slug = \$2/);
  assert.match(listQuery.sql, /a\.actor_user_id = \$3/);
  assert.match(listQuery.sql, /a\.created_at >= \$4/);
  assert.match(listQuery.sql, /a\.created_at <= \$5/);
  assert.deepEqual(listQuery.params, [
    "site.%",
    "admin",
    "user-1",
    "2026-01-01T00:00:00.000Z",
    "2026-12-31T23:59:59.000Z",
    25,
    0,
  ]);
});
