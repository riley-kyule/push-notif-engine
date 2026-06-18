import crypto from "node:crypto";

import type { SitesRepository, CreateSiteInput, UpdateSiteInput } from "./sites.repository";
import type { SiteListFilters, SiteListResult, SiteRecord } from "./sites.types";

export class InMemorySitesRepository implements SitesRepository {
  private readonly sites = new Map<string, SiteRecord>();

  async create(input: CreateSiteInput): Promise<SiteRecord> {
    const now = new Date();
    const site: SiteRecord = {
      id: crypto.randomUUID(),
      ...input,
      vapidSubject: input.vapidSubject,
      vapidPublicKey: input.vapidPublicKey,
      vapidPrivateKey: input.vapidPrivateKey,
      createdAt: now,
      updatedAt: now,
    };
    this.sites.set(site.id, site);
    return site;
  }

  async update(id: string, input: UpdateSiteInput): Promise<SiteRecord | null> {
    const existing = this.sites.get(id);
    if (!existing) {
      return null;
    }

    const updated: SiteRecord = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };
    this.sites.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<SiteRecord | null> {
    return this.sites.get(id) ?? null;
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

    const items = all.slice(filters.offset, filters.offset + filters.limit);
    return { items, total: all.length };
  }
}
