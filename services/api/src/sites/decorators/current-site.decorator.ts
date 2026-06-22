import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";

import type { SiteRecord } from "../sites.types";

export const CurrentSite = createParamDecorator((_data: unknown, context: ExecutionContext): SiteRecord => {
  const request = context.switchToHttp().getRequest<{ site?: SiteRecord }>();
  if (!request.site) {
    throw new InternalServerErrorException("Authenticated site missing from request");
  }

  return request.site;
});
