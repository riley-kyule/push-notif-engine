import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { RestApiAuthService } from "../rest-api-auth.service";
import type { SiteRecord } from "../sites.types";

type RestApiRequest = {
  headers: Record<string, string | string[] | undefined>;
  params: { siteId?: string };
  site?: SiteRecord;
};

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

@Injectable()
export class RestApiAuthGuard implements CanActivate {
  constructor(private readonly restApiAuthService: RestApiAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RestApiRequest>();
    const siteId = request.params.siteId;
    const siteKeyId = readHeaderValue(request.headers["x-epe-site-key"]);
    const authorization = readHeaderValue(request.headers.authorization);

    if (!siteId) {
      throw new UnauthorizedException("Missing site identifier");
    }

    if (!siteKeyId) {
      throw new UnauthorizedException("Missing REST API key");
    }

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing REST API token");
    }

    const authToken = authorization.slice("Bearer ".length).trim();
    if (!authToken) {
      throw new UnauthorizedException("Missing REST API token");
    }

    request.site = await this.restApiAuthService.authenticate(siteId, siteKeyId, authToken);
    return true;
  }
}
