import type {
  CampaignButton,
  CampaignContentType,
  CampaignChannel,
  CampaignListFilters,
  CampaignListResult,
  CampaignRecord,
  CampaignRecurrenceType,
  CampaignStatus,
  CampaignType,
} from "./campaigns.types";

export interface CreateCampaignInput {
  siteId: string;
  segmentId: string | null;
  name: string;
  channel: CampaignChannel;
  type: CampaignType;
  contentType: CampaignContentType;
  title: string;
  message: string;
  url: string;
  imageUrl: string | null;
  iconUrl: string | null;
  buttons: CampaignButton[];
  expirationAt: Date | null;
  status: CampaignStatus;
  scheduledAt: Date | null;
  timezone: string | null;
  recurrenceType: CampaignRecurrenceType | null;
  recurrenceInterval: number | null;
  recurrenceUntilAt: Date | null;
  clonedFromCampaignId: string | null;
  sentAt: Date | null;
}

export interface UpdateCampaignInput {
  segmentId?: string | null;
  name?: string;
  channel?: CampaignChannel;
  type?: CampaignType;
  contentType?: CampaignContentType;
  title?: string;
  message?: string;
  url?: string;
  imageUrl?: string | null;
  iconUrl?: string | null;
  buttons?: CampaignButton[];
  expirationAt?: Date | null;
  status?: CampaignStatus;
  scheduledAt?: Date | null;
  timezone?: string | null;
  recurrenceType?: CampaignRecurrenceType | null;
  recurrenceInterval?: number | null;
  recurrenceUntilAt?: Date | null;
  clonedFromCampaignId?: string | null;
  sentAt?: Date | null;
}

export interface CampaignsRepository {
  create(input: CreateCampaignInput): Promise<CampaignRecord>;
  update(id: string, input: UpdateCampaignInput): Promise<CampaignRecord | null>;
  findById(id: string): Promise<CampaignRecord | null>;
  delete(id: string): Promise<boolean>;
  list(filters: CampaignListFilters): Promise<CampaignListResult>;
  listDueScheduledCampaigns(asOf: Date): Promise<CampaignRecord[]>;
}
