export type SiteStatus = "active" | "inactive";

export interface SiteRecord {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface SiteListFilters {
  search?: string;
  status?: SiteStatus;
  country?: string;
  language?: string;
  limit: number;
  offset: number;
}

export interface SiteListResult {
  items: SiteRecord[];
  total: number;
}
