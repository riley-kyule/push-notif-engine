import { randomUUID } from "node:crypto";

import type { CampaignMediaRepository, CreateCampaignMediaInput } from "./campaign-media.repository";
import type { CampaignMediaKind, CampaignMediaRecord } from "./campaign-media.types";

const MAX_GALLERY_RESULTS = 60;

function clone(record: CampaignMediaRecord): CampaignMediaRecord {
  return { ...record };
}

export class InMemoryCampaignMediaRepository implements CampaignMediaRepository {
  public readonly assets: CampaignMediaRecord[] = [];

  async create(input: CreateCampaignMediaInput): Promise<CampaignMediaRecord> {
    const now = new Date();
    const asset: CampaignMediaRecord = {
      id: input.id ?? randomUUID(),
      siteId: input.siteId,
      campaignId: input.campaignId,
      kind: input.kind,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl,
      createdAt: now,
      updatedAt: now,
    };
    this.assets.push(asset);
    return clone(asset);
  }

  async findById(id: string): Promise<CampaignMediaRecord | null> {
    const asset = this.assets.find((entry) => entry.id === id);
    return asset ? clone(asset) : null;
  }

  async listByCampaignId(campaignId: string): Promise<CampaignMediaRecord[]> {
    return this.assets.filter((asset) => asset.campaignId === campaignId).map(clone);
  }

  async listBySiteId(siteId: string, kind?: CampaignMediaKind): Promise<CampaignMediaRecord[]> {
    return this.assets
      .filter((asset) => asset.siteId === siteId)
      .filter((asset) => !kind || asset.kind === kind)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, MAX_GALLERY_RESULTS)
      .map(clone);
  }

  async attachToCampaign(assetId: string, campaignId: string): Promise<CampaignMediaRecord | null> {
    const asset = this.assets.find((entry) => entry.id === assetId);
    if (!asset) {
      return null;
    }

    asset.campaignId = campaignId;
    asset.updatedAt = new Date();
    return clone(asset);
  }

  async deleteByIds(ids: string[]): Promise<number> {
    const toDelete = new Set(ids);
    const before = this.assets.length;
    for (let index = this.assets.length - 1; index >= 0; index -= 1) {
      if (toDelete.has(this.assets[index]?.id ?? "")) {
        this.assets.splice(index, 1);
      }
    }
    return before - this.assets.length;
  }

  async listCleanupCandidates(asOf: Date): Promise<CampaignMediaRecord[]> {
    const threshold = new Date(asOf.getTime() - 3 * 24 * 60 * 60 * 1000);
    return this.assets
      .filter((asset) => asset.campaignId !== null)
      .filter((asset) => asset.createdAt <= threshold)
      .map(clone);
  }
}
