import assert from "node:assert/strict";
import test from "node:test";

import { Reflector } from "@nestjs/core";

import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

test("roles guard authorizes matching roles", () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => ["admin"];

  const guard = new RolesGuard(reflector);
  const allowed = guard.canActivate({
    getHandler: () => Symbol("handler") as never,
    getClass: () => Symbol("class") as never,
    switchToHttp: () =>
      ({
        getRequest: () => ({ user: { role: "super-admin" } }),
      }) as never,
  } as never);

  assert.equal(allowed, true);
});
