import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import argon2 from "argon2";

import { SITES_REPOSITORY } from "./sites.constants";
import type { SitesRepository } from "./sites.repository";
import type { SiteRecord } from "./sites.types";

@Injectable()
export class RestApiAuthService {
  constructor(@Inject(SITES_REPOSITORY) private readonly sitesRepository: SitesRepository) {}

  async authenticate(siteId: string, siteKeyId: string, authToken: string): Promise<SiteRecord> {
    const site = await this.sitesRepository.findByIdWithRestApiCredentials(siteId);
    if (!site) {
      throw new NotFoundException("Site not found");
    }

    if (!site.restApiKeyId || !site.restApiAuthTokenHash) {
      throw new UnauthorizedException("REST API credentials are not configured");
    }

    if (site.restApiKeyId !== siteKeyId) {
      throw new UnauthorizedException("Invalid REST API credentials");
    }

    const tokenMatches = await argon2.verify(site.restApiAuthTokenHash, authToken);
    if (!tokenMatches) {
      throw new UnauthorizedException("Invalid REST API credentials");
    }

    const publicSite = await this.sitesRepository.findById(siteId);
    if (!publicSite) {
      throw new NotFoundException("Site not found");
    }

    return publicSite;
  }
}
