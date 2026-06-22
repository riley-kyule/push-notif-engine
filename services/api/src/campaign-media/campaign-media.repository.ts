import type { CampaignMediaKind, CampaignMediaRecord } from "./campaign-media.types";

export interface CreateCampaignMediaInput {
  id?: string;
  siteId: string;
  campaignId: string | null;
  kind: CampaignMediaKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
}

export interface CampaignMediaRepository {
  create(input: CreateCampaignMediaInput): Promise<CampaignMediaRecord>;
  findById(id: string): Promise<CampaignMediaRecord | null>;
  listByCampaignId(campaignId: string): Promise<CampaignMediaRecord[]>;
  attachToCampaign(assetId: string, campaignId: string): Promise<CampaignMediaRecord | null>;
  deleteByIds(ids: string[]): Promise<number>;
  listCleanupCandidates(asOf: Date): Promise<CampaignMediaRecord[]>;
}
