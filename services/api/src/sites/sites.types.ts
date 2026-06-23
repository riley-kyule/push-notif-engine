export type SiteStatus = "active" | "inactive";
export type OptInPromptType = "lightbox-1" | "lightbox-2" | "bell-icon";
export type OptInPromptAnimation = "slide-in" | "fade-in" | "pop";

export interface SiteRecord {
  id: string;
  name: string;
  url: string;
  country: string;
  language: string;
  platform: string;
  logoUrl: string | null;
  appName: string;
  iconUrl: string | null;
  themeColor: string | null;
  optInPromptType: OptInPromptType;
  optInPromptAnimation: OptInPromptAnimation;
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
  restApiKeyId: string | null;
  restApiAuthTokenLast4: string | null;
  restApiCredentialsGeneratedAt: Date | null;
  vapidSubject: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  status: SiteStatus;
  lastConnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SitePublicConfigRecord {
  id: string;
  appName: string;
  iconUrl: string | null;
  themeColor: string | null;
  vapidPublicKey: string | null;
  status: SiteStatus;
  optInPromptType: OptInPromptType;
  optInPromptAnimation: OptInPromptAnimation;
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
}

export interface SiteRestApiCredentialsRecord {
  id: string;
  restApiKeyId: string | null;
  restApiAuthTokenHash: string | null;
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
