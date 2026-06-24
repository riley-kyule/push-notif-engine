import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import argon2 from "argon2";
import crypto from "node:crypto";
import webpush from "web-push";

import { AuditService } from "../audit/audit.service";
import type { SiteListFilters, SiteListResult, SiteRecord } from "./sites.types";
import type { CreateSiteInput, SitesRepository, UpdateSiteInput } from "./sites.repository";
import { SITES_REPOSITORY } from "./sites.constants";
import { CreateSiteDto } from "./dto/create-site.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";
import { getTimezoneForCountry } from "./country-timezone.data";

@Injectable()
export class SitesService {
  constructor(
    @Inject(SITES_REPOSITORY) private readonly sitesRepository: SitesRepository,
    private readonly auditService: AuditService,
  ) {}

  async createSite(dto: CreateSiteDto, actorUserId?: string): Promise<SiteRecord> {
    await this.assertNoDuplicate(dto.url, dto.name);
    const site = await this.sitesRepository.create(this.normalizeCreateInput(dto));
    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "site.created",
      targetType: "site",
      targetId: site.id,
      metadata: { name: site.name, url: site.url },
    });
    return site;
  }

  async updateSite(id: string, dto: UpdateSiteDto, actorUserId?: string): Promise<SiteRecord> {
    const existing = await this.sitesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    if (dto.url || dto.name) {
      await this.assertNoDuplicate(dto.url ?? existing.url, dto.name ?? existing.name, id);
    }

    const updated = await this.sitesRepository.update(id, {
      name: dto.name ?? existing.name,
      url: dto.url ?? existing.url,
      country: dto.country ?? existing.country,
      timezone: dto.country ? getTimezoneForCountry(dto.country) : null,
      language: dto.language ?? existing.language,
      platform: dto.platform ?? existing.platform,
      logoUrl: dto.logoUrl === undefined ? existing.logoUrl : dto.logoUrl,
      appName: dto.appName === undefined ? existing.appName : this.normalizeAppName(dto.appName, existing.name),
      iconUrl: dto.iconUrl === undefined ? existing.iconUrl : this.normalizeIconUrl(dto.iconUrl),
      themeColor:
        dto.themeColor === undefined ? existing.themeColor : this.normalizeThemeColor(dto.themeColor),
      optInPromptType: dto.optInPromptType ?? existing.optInPromptType,
      optInPromptAnimation: dto.optInPromptAnimation ?? existing.optInPromptAnimation,
      optInPromptBackgroundColor:
        dto.optInPromptBackgroundColor === undefined
          ? existing.optInPromptBackgroundColor
          : this.normalizeColor(dto.optInPromptBackgroundColor),
      optInPromptHeadline:
        dto.optInPromptHeadline === undefined ? existing.optInPromptHeadline : this.normalizeText(dto.optInPromptHeadline),
      optInPromptHeadlineTextColor:
        dto.optInPromptHeadlineTextColor === undefined
          ? existing.optInPromptHeadlineTextColor
          : this.normalizeColor(dto.optInPromptHeadlineTextColor),
      optInPromptText:
        dto.optInPromptText === undefined ? existing.optInPromptText : this.normalizeText(dto.optInPromptText),
      optInPromptTextColor:
        dto.optInPromptTextColor === undefined
          ? existing.optInPromptTextColor
          : this.normalizeColor(dto.optInPromptTextColor),
      optInPromptIconUrl:
        dto.optInPromptIconUrl === undefined ? existing.optInPromptIconUrl : this.normalizeIconUrl(dto.optInPromptIconUrl),
      optInPromptCancelButtonLabel:
        dto.optInPromptCancelButtonLabel === undefined
          ? existing.optInPromptCancelButtonLabel
          : this.normalizeText(dto.optInPromptCancelButtonLabel),
      optInPromptCancelButtonTextColor:
        dto.optInPromptCancelButtonTextColor === undefined
          ? existing.optInPromptCancelButtonTextColor
          : this.normalizeColor(dto.optInPromptCancelButtonTextColor),
      optInPromptCancelButtonBackgroundColor:
        dto.optInPromptCancelButtonBackgroundColor === undefined
          ? existing.optInPromptCancelButtonBackgroundColor
          : this.normalizeColor(dto.optInPromptCancelButtonBackgroundColor),
      optInPromptApproveButtonLabel:
        dto.optInPromptApproveButtonLabel === undefined
          ? existing.optInPromptApproveButtonLabel
          : this.normalizeText(dto.optInPromptApproveButtonLabel),
      optInPromptApproveButtonTextColor:
        dto.optInPromptApproveButtonTextColor === undefined
          ? existing.optInPromptApproveButtonTextColor
          : this.normalizeColor(dto.optInPromptApproveButtonTextColor),
      optInPromptApproveButtonBackgroundColor:
        dto.optInPromptApproveButtonBackgroundColor === undefined
          ? existing.optInPromptApproveButtonBackgroundColor
          : this.normalizeColor(dto.optInPromptApproveButtonBackgroundColor),
      optInPromptRepromptDelayDays:
        dto.optInPromptRepromptDelayDays === undefined
          ? existing.optInPromptRepromptDelayDays
          : dto.optInPromptRepromptDelayDays,
      optInPromptRecentNotificationsLimit:
        dto.optInPromptRecentNotificationsLimit === undefined
          ? existing.optInPromptRecentNotificationsLimit
          : dto.optInPromptRecentNotificationsLimit,
      vapidSubject: dto.vapidSubject === undefined ? existing.vapidSubject : dto.vapidSubject,
      vapidPublicKey: dto.vapidPublicKey === undefined ? existing.vapidPublicKey : dto.vapidPublicKey,
      vapidPrivateKey: dto.vapidPrivateKey === undefined ? existing.vapidPrivateKey : dto.vapidPrivateKey,
      status: dto.status ?? existing.status,
    });
    if (!updated) {
      throw new NotFoundException("Site not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "site.updated",
      targetType: "site",
      targetId: updated.id,
      metadata: { changes: dto },
    });

    return updated;
  }

  async getSite(id: string): Promise<SiteRecord> {
    const site = await this.sitesRepository.findById(id);
    if (!site) {
      throw new NotFoundException("Site not found");
    }

    return site;
  }

  async recordConnection(id: string): Promise<void> {
    await this.sitesRepository.recordConnection(id);
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

  async generateVapidKeys(id: string, actorUserId?: string): Promise<SiteRecord> {
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

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "site.vapid_generated",
      targetType: "site",
      targetId: updated.id,
    });

    return updated;
  }

  async generateRestApiCredentials(
    id: string,
    actorUserId?: string,
  ): Promise<{ site: SiteRecord; authToken: string }> {
    const existing = await this.sitesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    const restApiKeyId = `rest_${crypto.randomBytes(12).toString("hex")}`;
    const authToken = crypto.randomBytes(32).toString("base64url");
    const authTokenHash = await argon2.hash(authToken);

    const updated = await this.sitesRepository.update(id, {
      restApiKeyId,
      restApiAuthTokenHash: authTokenHash,
      restApiAuthTokenLast4: authToken.slice(-4),
      restApiCredentialsGeneratedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundException("Site not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "site.rest_api_credentials_generated",
      targetType: "site",
      targetId: updated.id,
    });

    return { site: updated, authToken };
  }

  async deleteSite(id: string, actorUserId?: string): Promise<void> {
    const existing = await this.sitesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Site not found");
    }

    if (existing.status !== "inactive") {
      throw new BadRequestException("Site must be set to inactive before it can be deleted");
    }

    const deleted = await this.sitesRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException("Site not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "site.deleted",
      targetType: "site",
      targetId: id,
      metadata: { name: existing.name, url: existing.url },
    });
  }

  // Case-insensitive: catches "https://Example.com" vs "https://example.com"
  // and "Exotic Travel" vs "exotic travel" as the same site, not just exact
  // string matches. excludeId lets updateSite check without tripping on the
  // site's own current name/url.
  private async assertNoDuplicate(url: string, name: string, excludeId?: string): Promise<void> {
    const [byUrl, byName] = await Promise.all([
      this.sitesRepository.findByUrl(url),
      this.sitesRepository.findByName(name),
    ]);

    if (byUrl && byUrl.id !== excludeId) {
      throw new ConflictException(`A site with the URL "${byUrl.url}" already exists.`);
    }
    if (byName && byName.id !== excludeId) {
      throw new ConflictException(`A site named "${byName.name}" already exists.`);
    }
  }

  private normalizeCreateInput(dto: CreateSiteDto): CreateSiteInput {
    return {
      name: dto.name,
      url: dto.url,
      country: dto.country,
      timezone: getTimezoneForCountry(dto.country),
      language: dto.language,
      platform: dto.platform,
      logoUrl: dto.logoUrl ?? null,
      appName: this.normalizeAppName(dto.appName, dto.name),
      iconUrl: this.normalizeIconUrl(dto.iconUrl),
      themeColor: this.normalizeThemeColor(dto.themeColor),
      optInPromptType: dto.optInPromptType ?? "lightbox-1",
      optInPromptAnimation: dto.optInPromptAnimation ?? "slide-in",
      optInPromptBackgroundColor: this.normalizeColor(dto.optInPromptBackgroundColor),
      optInPromptHeadline: this.normalizeText(dto.optInPromptHeadline) ?? "Would you like to stay updated?",
      optInPromptHeadlineTextColor: this.normalizeColor(dto.optInPromptHeadlineTextColor) ?? "#111111",
      optInPromptText: this.normalizeText(dto.optInPromptText) ?? "Get timely browser notifications for important updates.",
      optInPromptTextColor: this.normalizeColor(dto.optInPromptTextColor) ?? "#444444",
      optInPromptIconUrl: this.normalizeIconUrl(dto.optInPromptIconUrl),
      optInPromptCancelButtonLabel: this.normalizeText(dto.optInPromptCancelButtonLabel) ?? "Not now",
      optInPromptCancelButtonTextColor: this.normalizeColor(dto.optInPromptCancelButtonTextColor) ?? "#ffffff",
      optInPromptCancelButtonBackgroundColor:
        this.normalizeColor(dto.optInPromptCancelButtonBackgroundColor) ?? "#111111",
      optInPromptApproveButtonLabel: this.normalizeText(dto.optInPromptApproveButtonLabel) ?? "Enable",
      optInPromptApproveButtonTextColor: this.normalizeColor(dto.optInPromptApproveButtonTextColor) ?? "#ffffff",
      optInPromptApproveButtonBackgroundColor:
        this.normalizeColor(dto.optInPromptApproveButtonBackgroundColor) ?? "#ea580c",
      optInPromptRepromptDelayDays:
        dto.optInPromptRepromptDelayDays ?? 30,
      optInPromptRecentNotificationsLimit: dto.optInPromptRecentNotificationsLimit ?? 3,
      vapidSubject: dto.vapidSubject ?? null,
      vapidPublicKey: dto.vapidPublicKey ?? null,
      vapidPrivateKey: dto.vapidPrivateKey ?? null,
      status: dto.status ?? "active",
    };
  }

  private normalizeAppName(appName: string | undefined, fallback: string): string {
    return appName?.trim() ? appName.trim() : fallback;
  }

  private normalizeIconUrl(iconUrl: string | null | undefined): string | null {
    if (iconUrl === undefined) {
      return null;
    }

    return iconUrl?.trim() ? iconUrl.trim() : null;
  }

  private normalizeThemeColor(themeColor: string | null | undefined): string | null {
    if (themeColor === undefined) {
      return null;
    }

    const value = themeColor === null ? "" : themeColor.trim();
    return value ? value : null;
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const normalized = value?.trim() ?? "";
    return normalized ? normalized : null;
  }

  private normalizeColor(value: string | null | undefined): string | null {
    return this.normalizeText(value);
  }
}
