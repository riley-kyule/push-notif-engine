import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import webpush from "web-push";

import type { SiteListFilters, SiteListResult, SiteRecord } from "./sites.types";
import type { CreateSiteInput, SitesRepository, UpdateSiteInput } from "./sites.repository";
import { SITES_REPOSITORY } from "./sites.constants";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";

@Injectable()
export class SitesService {
  constructor(@Inject(SITES_REPOSITORY) private readonly sitesRepository: SitesRepository) {}

  async createSite(dto: CreateSiteDto): Promise<SiteRecord> {
    return this.sitesRepository.create(this.normalizeCreateInput(dto));
  }

  async updateSite(id: string, dto: UpdateSiteDto): Promise<SiteRecord> {
    const existing = await this.sitesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    const updated = await this.sitesRepository.update(id, {
      name: dto.name ?? existing.name,
      url: dto.url ?? existing.url,
      country: dto.country ?? existing.country,
      language: dto.language ?? existing.language,
      platform: dto.platform ?? existing.platform,
      logoUrl: dto.logoUrl === undefined ? existing.logoUrl : dto.logoUrl,
      vapidSubject: dto.vapidSubject === undefined ? existing.vapidSubject : dto.vapidSubject,
      vapidPublicKey: dto.vapidPublicKey === undefined ? existing.vapidPublicKey : dto.vapidPublicKey,
      vapidPrivateKey: dto.vapidPrivateKey === undefined ? existing.vapidPrivateKey : dto.vapidPrivateKey,
      status: dto.status ?? existing.status,
    });
    if (!updated) {
      throw new NotFoundException("Site not found");
    }

    return updated;
  }

  async getSite(id: string): Promise<SiteRecord> {
    const site = await this.sitesRepository.findById(id);
    if (!site) {
      throw new NotFoundException("Site not found");
    }

    return site;
  }

  async listSites(filters: Partial<SiteListFilters>): Promise<SiteListResult> {
    const normalized: SiteListFilters = {
      limit: filters.limit ?? 20,
      offset: filters.offset ?? 0,
    };

    if (filters.search) normalized.search = filters.search;
    if (filters.status) normalized.status = filters.status;
    if (filters.country) normalized.country = filters.country;
    if (filters.language) normalized.language = filters.language;

    return this.sitesRepository.list(normalized);
  }

  async generateVapidKeys(id: string): Promise<SiteRecord> {
    const existing = await this.sitesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    const vapidKeys = webpush.generateVAPIDKeys();

    let hostname: string;
    try {
      hostname = new URL(existing.url).hostname;
    } catch {
      throw new BadRequestException("Site URL is not a valid URL — cannot derive VAPID subject");
    }

    const updated = await this.sitesRepository.update(id, {
      vapidSubject: `mailto:push@${hostname}`,
      vapidPublicKey: vapidKeys.publicKey,
      vapidPrivateKey: vapidKeys.privateKey,
    });

    if (!updated) {
      throw new NotFoundException("Site not found");
    }

    return updated;
  }

  private normalizeCreateInput(dto: CreateSiteDto): CreateSiteInput {
    return {
      name: dto.name,
      url: dto.url,
      country: dto.country,
      language: dto.language,
      platform: dto.platform,
      logoUrl: dto.logoUrl ?? null,
      vapidSubject: dto.vapidSubject ?? null,
      vapidPublicKey: dto.vapidPublicKey ?? null,
      vapidPrivateKey: dto.vapidPrivateKey ?? null,
      status: dto.status ?? "active",
    };
  }
}
