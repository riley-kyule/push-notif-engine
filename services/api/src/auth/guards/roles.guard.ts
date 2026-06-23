import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLE_ORDER, canonicalRoleSlug } from "../auth.constants";
import type { AuthenticatedUser, RoleSlug } from "../auth.types";
import { ROLES_KEY } from "../decorators/roles.decorator";

function rank(role: RoleSlug): number {
  return ROLE_ORDER.indexOf(canonicalRoleSlug(role));
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<RoleSlug[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const userRole = request.user?.role;

    if (!userRole) {
      throw new ForbiddenException("Missing role");
    }

    const hasAccess = allowedRoles.some((role) => rank(userRole) <= rank(role));

    if (!hasAccess) {
      throw new ForbiddenException("Insufficient role");
    }

    return true;
  }
}
