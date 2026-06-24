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
  // Gallery/library lookup -- every asset uploaded, regardless of whether
  // it's currently attached to a campaign. siteId omitted means every site
  // (the centralized Media Library page); the per-form picker always
  // passes one.
  listGallery(filters: { siteId?: string | undefined; kind?: CampaignMediaKind | undefined; limit: number; offset: number }): Promise<{
    items: CampaignMediaRecord[];
    total: number;
  }>;
  attachToCampaign(assetId: string, campaignId: string): Promise<CampaignMediaRecord | null>;
  deleteByIds(ids: string[]): Promise<number>;
  listCleanupCandidates(asOf: Date): Promise<CampaignMediaRecord[]>;
}
