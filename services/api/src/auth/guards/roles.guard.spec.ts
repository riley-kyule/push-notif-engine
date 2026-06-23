import assert from "node:assert/strict";
import test from "node:test";

import { Reflector } from "@nestjs/core";

import { RolesGuard } from "./roles.guard";

test("roles guard authorizes matching roles and legacy aliases", () => {
  const reflector = new Reflector();
  reflector.getAllAndOverride = () => ["sub-admin"];

  const guard = new RolesGuard(reflector);
  const allowed = guard.canActivate({
    getHandler: () => Symbol("handler") as never,
    getClass: () => Symbol("class") as never,
    switchToHttp: () =>
      ({
        getRequest: () => ({ user: { role: "editor" } }),
      }) as never,
  } as never);

  assert.equal(allowed, true);
});
