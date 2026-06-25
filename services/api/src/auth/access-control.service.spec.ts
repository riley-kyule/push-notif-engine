import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { AccessControlService } from "./access-control.service";
import { PasswordService } from "./password.service";
import type { RoleRecord } from "./auth.repository";

const roles: RoleRecord[] = [
  { id: "role-1", slug: "super-admin", name: "Super Admin", permissions: ["roles:manage"] },
  { id: "role-2", slug: "admin", name: "Admin", permissions: [] },
  { id: "role-3", slug: "sub-admin", name: "Sub-Admin", permissions: ["sites:manage"] },
];

test("access control service can create users and update roles", async () => {
  const repository = new InMemoryAuthRepository({ roles });
  const passwordService = new PasswordService();
  const auditService = { async log() { return undefined; } };
  const service = new AccessControlService(repository as never, passwordService, auditService as never);

  const user = await service.createUser(
    {
      email: "new-user@example.com",
      firstName: "New",
      lastName: "User",
      role: "sub-admin",
    },
    "actor-1",
  );

  assert.equal(user.email, "new-user@example.com");
  assert.equal(user.role, "sub-admin");
  assert.equal(user.username.startsWith("new"), true);
  assert.equal(typeof user.password, "string");
  assert.ok(user.password.length >= 8);

  const updatedRole = await service.updateRole("sub-admin", { name: "Sub Admin", permissions: ["sites:manage"] }, "actor-1");
  assert.equal(updatedRole.name, "Sub Admin");
  assert.deepEqual(updatedRole.permissions, ["sites:manage"]);
});

test("access control service accepts an explicit password and verifies it hashes correctly", async () => {
  const repository = new InMemoryAuthRepository({ roles });
  const passwordService = new PasswordService();
  const auditService = { async log() { return undefined; } };
  const service = new AccessControlService(repository as never, passwordService, auditService as never);

  const user = await service.createUser(
    { email: "explicit@example.com", firstName: "Pat", lastName: "Doe", role: "sub-admin", password: "correct-horse-battery" },
    "actor-1",
  );

  assert.equal(user.password, "correct-horse-battery");
  const stored = await repository.findUserById(user.id);
  assert.ok(stored?.passwordHash);
  assert.equal(await passwordService.verify(stored!.passwordHash!, "correct-horse-battery"), true);
});

test("access control service resets a user's password and returns the new plaintext once", async () => {
  const repository = new InMemoryAuthRepository({ roles });
  const passwordService = new PasswordService();
  const auditService = { async log() { return undefined; } };
  const service = new AccessControlService(repository as never, passwordService, auditService as never);

  const created = await service.createUser(
    { email: "reset-me@example.com", firstName: "Rae", lastName: "Set", role: "sub-admin" },
    "actor-1",
  );

  const reset = await service.resetUserPassword(created.id, {}, "actor-1");
  assert.notEqual(reset.password, created.password);

  const stored = await repository.findUserById(created.id);
  assert.equal(await passwordService.verify(stored!.passwordHash!, reset.password), true);
  assert.equal(await passwordService.verify(stored!.passwordHash!, created.password), false);
});

test("an admin cannot promote anyone to super-admin", async () => {
  const repository = new InMemoryAuthRepository({ roles });
  const passwordService = new PasswordService();
  const auditService = { async log() { return undefined; } };
  const service = new AccessControlService(repository as never, passwordService, auditService as never);

  const adminActor = await service.createUser({ email: "admin-actor@example.com", firstName: "Ad", lastName: "Min", role: "admin" }, undefined);
  const target = await service.createUser({ email: "target@example.com", firstName: "Tar", lastName: "Get", role: "sub-admin" }, undefined);

  await assert.rejects(
    () => service.updateUserRole(target.id, "super-admin", adminActor.id),
    /Cannot grant a role more privileged than your own/,
  );
});

test("an admin cannot change the role of an existing super-admin", async () => {
  const repository = new InMemoryAuthRepository({ roles });
  const passwordService = new PasswordService();
  const auditService = { async log() { return undefined; } };
  const service = new AccessControlService(repository as never, passwordService, auditService as never);

  const adminActor = await service.createUser({ email: "admin-actor-2@example.com", firstName: "Ad", lastName: "Min", role: "admin" }, undefined);
  const superAdminTarget = await service.createUser({ email: "super@example.com", firstName: "Su", lastName: "Per", role: "super-admin" }, undefined);

  await assert.rejects(
    () => service.updateUserRole(superAdminTarget.id, "admin", adminActor.id),
    /Cannot change the role of a user more privileged than you/,
  );
});

test("a super-admin can promote a user to admin", async () => {
  const repository = new InMemoryAuthRepository({ roles });
  const passwordService = new PasswordService();
  const auditService = { async log() { return undefined; } };
  const service = new AccessControlService(repository as never, passwordService, auditService as never);

  const superAdminActor = await service.createUser({ email: "root@example.com", firstName: "Ro", lastName: "Ot", role: "super-admin" }, undefined);
  const target = await service.createUser({ email: "promote-me@example.com", firstName: "Pro", lastName: "Mote", role: "sub-admin" }, undefined);

  const updated = await service.updateUserRole(target.id, "admin", superAdminActor.id);
  assert.equal(updated.role, "admin");
});
