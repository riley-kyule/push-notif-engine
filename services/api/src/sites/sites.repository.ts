import type { SiteListFilters, SiteListResult, SiteRecord, SiteRestApiCredentialsRecord, SiteStatus } from "./sites.types";

export interface CreateSiteInput {
  name: string;
  url: string;
  country: string;
  timezone: string;
  language: string;
  platform: string;
  logoUrl: string | null;
  appName: string;
  iconUrl: string | null;
  themeColor: string | null;
  optInPromptType: "lightbox-1" | "lightbox-2" | "bell-icon";
  optInPromptAnimation: "slide-in" | "fade-in" | "pop";
  optInPromptBackgroundColor: string | null;
  optInPromptHeadline: string | null;
  optInPromptHeadlineTextColor: string | null;
  optInPromptText: string | null;
  optInPromptTextColor: string | null;
  optInPromptIconUrl: string | null;
  optInPromptCancelButtonLabel: string | null;
  optInPromptCancelButtonTextColor: string | null;
  optInPromptCancelButtonBackgroundColor: string | null;
  optInPromptApproveButtonLabel: string | null;
  optInPromptApproveButtonTextColor: string | null;
  optInPromptApproveButtonBackgroundColor: string | null;
  optInPromptRepromptDelayDays: number | null;
  optInPromptRecentNotificationsLimit: number | null;
  restApiKeyId?: string | null;
  restApiAuthTokenHash?: string | null;
  restApiAuthTokenLast4?: string | null;
  restApiCredentialsGeneratedAt?: Date | null;
  vapidSubject: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  status: SiteStatus;
}

export interface UpdateSiteInput {
  name?: string;
  url?: string;
  country?: string;
  timezone?: string | null;
  language?: string;
  platform?: string;
  logoUrl?: string | null;
  appName?: string;
  iconUrl?: string | null;
  themeColor?: string | null;
  optInPromptType?: "lightbox-1" | "lightbox-2" | "bell-icon";
  optInPromptAnimation?: "slide-in" | "fade-in" | "pop";
  optInPromptBackgroundColor?: string | null;
  optInPromptHeadline?: string | null;
  optInPromptHeadlineTextColor?: string | null;
  optInPromptText?: string | null;
  optInPromptTextColor?: string | null;
  optInPromptIconUrl?: string | null;
  optInPromptCancelButtonLabel?: string | null;
  optInPromptCancelButtonTextColor?: string | null;
  optInPromptCancelButtonBackgroundColor?: string | null;
  optInPromptApproveButtonLabel?: string | null;
  optInPromptApproveButtonTextColor?: string | null;
  optInPromptApproveButtonBackgroundColor?: string | null;
  optInPromptRepromptDelayDays?: number | null;
  optInPromptRecentNotificationsLimit?: number | null;
  restApiKeyId?: string | null;
  restApiAuthTokenHash?: string | null;
  restApiAuthTokenLast4?: string | null;
  restApiCredentialsGeneratedAt?: Date | null;
  vapidSubject?: string | null;
  vapidPublicKey?: string | null;
  vapidPrivateKey?: string | null;
  status?: SiteStatus;
}

export interface SitesRepository {
  create(input: CreateSiteInput): Promise<SiteRecord>;
  update(id: string, input: UpdateSiteInput): Promise<SiteRecord | null>;
  findById(id: string): Promise<SiteRecord | null>;
  findByIdWithRestApiCredentials(id: string): Promise<SiteRestApiCredentialsRecord | null>;
  // Case-insensitive exact match, for duplicate prevention on create/update.
  findByUrl(url: string): Promise<SiteRecord | null>;
  findByName(name: string): Promise<SiteRecord | null>;
  list(filters: SiteListFilters): Promise<SiteListResult>;
  delete(id: string): Promise<boolean>;
  recordConnection(id: string): Promise<void>;
}
