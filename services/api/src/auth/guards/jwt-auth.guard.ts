import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import jwt from "jsonwebtoken";

import { loadAuthConfig } from "../config/auth.config";
import type { JwtPayload, AuthenticatedUser } from "../auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authorization.slice("Bearer ".length);
    const config = loadAuthConfig();

    try {
      const payload = jwt.verify(token, config.accessTokenSecret) as JwtPayload;
      if (payload.type !== "access") {
        throw new UnauthorizedException("Invalid access token");
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        role: payload.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
