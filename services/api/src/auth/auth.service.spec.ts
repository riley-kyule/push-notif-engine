import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { AuthService } from "./auth.service";
import type { AuthUserRecord, RoleRecord } from "./auth.repository";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { AuditService } from "../audit/audit.service";

process.env.JWT_ACCESS_SECRET = "access-secret-for-tests";
process.env.JWT_REFRESH_SECRET = "refresh-secret-for-tests";

const role: RoleRecord = {
  id: "role-1",
  slug: "admin",
  name: "Admin",
};

test("auth service logs in and rotates refresh tokens", async () => {
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const passwordHash = await passwordService.hash("Password123!");

  const user: AuthUserRecord = {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin User",
    passwordHash,
    role: "admin",
    isActive: true,
  };

  const repository = new InMemoryAuthRepository({
    roles: [role],
    users: [user],
  });

  const auditService = {
    async log() {
      return undefined;
    },
  } as unknown as AuditService;

  const authService = new AuthService(repository, passwordService, tokenService, auditService);

  const session = await authService.login("admin@example.com", "Password123!");

  assert.equal(session.user.email, "admin@example.com");
  assert.ok(session.tokens.accessToken.length > 0);
  assert.ok(session.tokens.refreshToken.length > 0);

  const refreshed = await authService.refreshTokens(session.tokens.refreshToken);
  assert.equal(refreshed.user.id, "user-1");
  assert.notEqual(refreshed.tokens.refreshToken, session.tokens.refreshToken);
});
