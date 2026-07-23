export type CampaignType = "instant" | "scheduled" | "recurring";

export type CampaignContentType = string;

export type CampaignChannel = "web" | "mobile" | "all";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "expired";

export type CampaignRecurrenceType = "daily" | "weekly" | "monthly";

export interface CampaignButton {
  label: string;
  url: string;
}

export interface CampaignVariant {
  id: string;
  title: string;
  message: string;
  url: string;
  weight: number;
}

export interface CampaignRecord {
  id: string;
  siteId: string;
  segmentId: string | null;
  name: string;
  contentType: CampaignContentType;
  channel: CampaignChannel;
  type: CampaignType;
  title: string;
  message: string;
  url: string;
  imageUrl: string | null;
  iconUrl: string | null;
  buttons: CampaignButton[];
  abVariants: CampaignVariant[];
  expirationAt: Date | null;
  status: CampaignStatus;
  scheduledAt: Date | null;
  timezone: string | null;
  recurrenceType: CampaignRecurrenceType | null;
  recurrenceInterval: number | null;
  recurrenceUntilAt: Date | null;
  clonedFromCampaignId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignSortField = "name" | "type" | "status" | "scheduledAt" | "sentAt" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface CampaignListFilters {
  siteId?: string;
  type?: CampaignType;
  status?: CampaignStatus;
  contentType?: CampaignContentType;
  sortBy?: CampaignSortField;
  sortDir?: SortDirection;
  limit: number;
  offset: number;
}

export interface CampaignListResult {
  items: CampaignRecord[];
  total: number;
}
