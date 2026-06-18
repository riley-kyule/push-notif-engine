import type { SiteListFilters, SiteListResult, SiteRecord, SiteStatus } from "./sites.types";

export interface CreateSiteInput {
  name: string;
  url: string;
  country: string;
  language: string;
  platform: string;
  logoUrl: string | null;
  vapidSubject: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  status: SiteStatus;
}

export interface UpdateSiteInput {
  name?: string;
  url?: string;
  country?: string;
  language?: string;
  platform?: string;
  logoUrl?: string | null;
  vapidSubject?: string | null;
  vapidPublicKey?: string | null;
  vapidPrivateKey?: string | null;
  status?: SiteStatus;
}

export interface SitesRepository {
  create(input: CreateSiteInput): Promise<SiteRecord>;
  update(id: string, input: UpdateSiteInput): Promise<SiteRecord | null>;
  findById(id: string): Promise<SiteRecord | null>;
  list(filters: SiteListFilters): Promise<SiteListResult>;
}
