export type CampaignMediaKind = "image" | "icon";

export interface CampaignMediaRecord {
  id: string;
  siteId: string;
  campaignId: string | null;
  kind: CampaignMediaKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignMediaUploadResult {
  id: string;
  publicUrl: string;
  kind: CampaignMediaKind;
}
