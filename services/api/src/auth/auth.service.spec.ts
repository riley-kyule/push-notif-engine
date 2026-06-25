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
  permissions: ["users:manage", "sites:manage"],
};

test("auth service logs in and rotates refresh tokens", async () => {
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const passwordHash = await passwordService.hash("Password123!");

  const user: AuthUserRecord = {
    id: "user-1",
    firstName: "Admin",
    lastName: "User",
    username: "adminuser",
    email: "admin@example.com",
    name: "Admin User",
    passwordHash,
    role: "admin",
    isActive: true,
    authProvider: "local",
    googleSubject: null,
    emailVerifiedAt: null,
    lastLoginAt: null,
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

  const googleIdentityService = {
    async verifyIdToken() {
      throw new Error("not expected");
    },
  };

  const authService = new AuthService(
    repository,
    passwordService,
    tokenService,
    googleIdentityService as never,
    auditService,
  );

  const session = await authService.login("admin@example.com", "Password123!");

  assert.equal(session.user.email, "admin@example.com");
  assert.ok(session.tokens.accessToken.length > 0);
  assert.ok(session.tokens.refreshToken.length > 0);

  const refreshed = await authService.refreshTokens(session.tokens.refreshToken);
  assert.equal(refreshed.user.id, "user-1");
  assert.notEqual(refreshed.tokens.refreshToken, session.tokens.refreshToken);
});

test("auth service logout revokes the refresh token so it can no longer mint new sessions", async () => {
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const passwordHash = await passwordService.hash("Password123!");

  const user: AuthUserRecord = {
    id: "user-1",
    firstName: "Admin",
    lastName: "User",
    username: "adminuser",
    email: "admin@example.com",
    name: "Admin User",
    passwordHash,
    role: "admin",
    isActive: true,
    authProvider: "local",
    googleSubject: null,
    emailVerifiedAt: null,
    lastLoginAt: null,
  };

  const repository = new InMemoryAuthRepository({ roles: [role], users: [user] });
  const auditService = {
    async log() {
      return undefined;
    },
  } as unknown as AuditService;
  const googleIdentityService = {
    async verifyIdToken() {
      throw new Error("not expected");
    },
  };

  const authService = new AuthService(repository, passwordService, tokenService, googleIdentityService as never, auditService);

  const session = await authService.login("admin@example.com", "Password123!");
  await authService.logout(session.tokens.refreshToken);

  await assert.rejects(() => authService.refreshTokens(session.tokens.refreshToken), /revoked/i);
});

test("auth service logout on an already-invalid token does not throw", async () => {
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const repository = new InMemoryAuthRepository({ roles: [role], users: [] });
  const auditService = { async log() { return undefined; } } as unknown as AuditService;
  const googleIdentityService = { async verifyIdToken() { throw new Error("not expected"); } };

  const authService = new AuthService(repository, passwordService, tokenService, googleIdentityService as never, auditService);

  await assert.doesNotReject(() => authService.logout("not-a-real-token"));
});

test("auth service links and logs in with google identity", async () => {
  const passwordService = new PasswordService();
  const tokenService = new TokenService();

  const user: AuthUserRecord = {
    id: "user-2",
    firstName: "Editor",
    lastName: "User",
    username: "editoruser",
    email: "editor@example.com",
    name: "Editor User",
    passwordHash: null,
    role: "sub-admin",
    isActive: true,
    authProvider: "local",
    googleSubject: null,
    emailVerifiedAt: null,
    lastLoginAt: null,
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

  const googleIdentityService = {
    async verifyIdToken() {
      return {
        subject: "google-subject-1",
        email: "editor@example.com",
        emailVerified: true,
      };
    },
  };

  const authService = new AuthService(
    repository,
    passwordService,
    tokenService,
    googleIdentityService as never,
    auditService,
  );

  const session = await authService.loginWithGoogle("google-id-token");
  assert.equal(session.user.email, "editor@example.com");
  const linked = await repository.findUserByEmail("editor@example.com");
  assert.equal(linked?.googleSubject, "google-subject-1");
  assert.equal(linked?.authProvider, "google");
});
