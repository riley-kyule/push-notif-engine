import { Controller, Get, UseGuards } from "@nestjs/common";

import { CurrentSite } from "./decorators/current-site.decorator";
import { RestApiAuthGuard } from "./guards/rest-api-auth.guard";
import type { SiteRecord } from "./sites.types";

@Controller("sites/:siteId/rest-api")
@UseGuards(RestApiAuthGuard)
export class RestApiController {
  @Get("identity")
  async identity(@CurrentSite() site: SiteRecord): Promise<{
    success: true;
    data: { siteId: string; siteName: string; keyId: string | null; authTokenLast4: string | null };
  }> {
    return {
      success: true,
      data: {
        siteId: site.id,
        siteName: site.name,
        keyId: site.restApiKeyId,
        authTokenLast4: site.restApiAuthTokenLast4,
      },
    };
  }
}
