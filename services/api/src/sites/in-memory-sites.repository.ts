import crypto from "node:crypto";

import type { SitesRepository, CreateSiteInput, UpdateSiteInput, SiteAutomationDefaultsRecord } from "./sites.repository";
import type { SiteListFilters, SiteListResult, SiteRecord, SiteRestApiCredentialsRecord } from "./sites.types";

export class InMemorySitesRepository implements SitesRepository {
  private readonly sites = new Map<string, SiteRecord & { restApiAuthTokenHash: string | null }>();

  async create(input: CreateSiteInput): Promise<SiteRecord> {
    const now = new Date();
    const site = {
      id: crypto.randomUUID(),
      ...input,
      appName: input.appName,
      iconUrl: input.iconUrl,
      themeColor: input.themeColor,
      restApiKeyId: input.restApiKeyId ?? null,
      restApiAuthTokenHash: input.restApiAuthTokenHash ?? null,
      restApiAuthTokenLast4: input.restApiAuthTokenLast4 ?? null,
      restApiCredentialsGeneratedAt: input.restApiCredentialsGeneratedAt ?? null,
      vapidSubject: input.vapidSubject,
      vapidPublicKey: input.vapidPublicKey,
      vapidPrivateKey: input.vapidPrivateKey,
      lastConnectedAt: null,
      subscriberCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.sites.set(site.id, site);
    const { restApiAuthTokenHash: _restApiAuthTokenHash, ...publicSite } = site;
    return publicSite;
  }

  async update(id: string, input: UpdateSiteInput): Promise<SiteRecord | null> {
    const existing = this.sites.get(id);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };
    this.sites.set(id, updated);
    const { restApiAuthTokenHash: _restApiAuthTokenHash, ...publicSite } = updated;
    return publicSite;
  }

  async findById(id: string): Promise<SiteRecord | null> {
    const site = this.sites.get(id);
    if (!site) {
      return null;
    }

    const { restApiAuthTokenHash: _restApiAuthTokenHash, ...publicSite } = site;
    return publicSite;
  }

  async findAutomationDefaultsById(id: string): Promise<SiteAutomationDefaultsRecord | null> {
    const site = this.sites.get(id);
    if (!site) {
      return null;
    }

    return {
      id: site.id,
      name: site.name,
      url: site.url,
    };
  }

  async findByIdWithRestApiCredentials(id: string): Promise<SiteRestApiCredentialsRecord | null> {
    const site = this.sites.get(id);
    if (!site) {
      return null;
    }

    return {
      id: site.id,
      restApiKeyId: site.restApiKeyId,
      restApiAuthTokenHash: site.restApiAuthTokenHash,
    };
  }

  async delete(id: string): Promise<boolean> {
    return this.sites.delete(id);
  }

  async findByUrl(url: string): Promise<SiteRecord | null> {
    const match = Array.from(this.sites.values()).find((site) => site.url.toLowerCase() === url.toLowerCase());
    if (!match) return null;
    const { restApiAuthTokenHash: _restApiAuthTokenHash, ...publicSite } = match;
    return publicSite;
  }

  async findByName(name: string): Promise<SiteRecord | null> {
    const match = Array.from(this.sites.values()).find((site) => site.name.toLowerCase() === name.toLowerCase());
    if (!match) return null;
    const { restApiAuthTokenHash: _restApiAuthTokenHash, ...publicSite } = match;
    return publicSite;
  }

  async list(filters: SiteListFilters): Promise<SiteListResult> {
    const all = Array.from(this.sites.values()).filter((site) => {
      if (filters.status && site.status !== filters.status) return false;
      if (filters.country && site.country !== filters.country) return false;
      if (filters.language && site.language !== filters.language) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return site.name.toLowerCase().includes(search) || site.url.toLowerCase().includes(search);
      }
      return true;
    });

    const sortAccessors: Record<NonNullable<SiteListFilters["sortBy"]>, (site: SiteRecord) => string | number> = {
      name: (site) => site.name.toLowerCase(),
      createdAt: (site) => site.createdAt.getTime(),
      subscriberCount: (site) => site.subscriberCount,
      connection: (site) => site.lastConnectedAt?.getTime() ?? -Infinity,
      country: (site) => site.country,
    };
    const sortAccessor = sortAccessors[filters.sortBy ?? "createdAt"];
    const sortDir = filters.sortDir === "asc" ? 1 : -1;
    const sorted = [...all].sort((left, right) => {
      const leftValue = sortAccessor(left);
      const rightValue = sortAccessor(right);
      if (leftValue < rightValue) return -1 * sortDir;
      if (leftValue > rightValue) return 1 * sortDir;
      return 0;
    });

    const items = sorted.slice(filters.offset, filters.offset + filters.limit);
    return { items, total: all.length };
  }

  async recordConnection(id: string): Promise<void> {
    const existing = this.sites.get(id);
    if (!existing) {
      return;
    }
    this.sites.set(id, { ...existing, lastConnectedAt: new Date() });
  }
}
