import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

import { SitesService } from "../sites/sites.service";
import type { CampaignRecord } from "../campaigns/campaigns.types";
import { CAMPAIGN_MEDIA_REPOSITORY, CAMPAIGN_MEDIA_STORAGE } from "./campaign-media.constants";
import type { CampaignMediaRepository } from "./campaign-media.repository";
import type { CampaignMediaUploadFile } from "./campaign-media-file.type";
import type { CampaignMediaStoragePort } from "./campaign-media-storage.port";
import type { CampaignMediaKind, CampaignMediaRecord, CampaignMediaUploadResult } from "./campaign-media.types";

const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(value: string): string {
  const fallback = value.trim().length > 0 ? value : "upload";
  return basename(fallback).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

@Injectable()
export class CampaignMediaService {
  constructor(
    private readonly sitesService: SitesService,
    @Inject(CAMPAIGN_MEDIA_REPOSITORY) private readonly campaignMediaRepository: CampaignMediaRepository,
    @Inject(CAMPAIGN_MEDIA_STORAGE) private readonly campaignMediaStorage: CampaignMediaStoragePort,
  ) {}

  async uploadMedia(input: {
    siteId: string;
    kind: CampaignMediaKind;
    file: CampaignMediaUploadFile;
  }): Promise<CampaignMediaUploadResult> {
    await this.sitesService.getSite(input.siteId);
    if (!input.file) {
      throw new BadRequestException("File is required");
    }
    if (!input.file.mimetype.startsWith("image/")) {
      throw new BadRequestException("Only image files can be uploaded");
    }
    if (input.file.size > MAX_MEDIA_SIZE_BYTES) {
      throw new BadRequestException("Uploaded images must be 5 MB or smaller");
    }

    const assetId = randomUUID();
    const extension = extname(input.file.originalname) || ".bin";
    const storagePath = `campaign-media/${assetId}${extension}`;
    const publicUrl = `${this.getApiBaseUrl().replace(/\/$/, "")}/campaign-media/${assetId}/file`;

    await this.campaignMediaStorage.upload({
      key: storagePath,
      body: input.file.buffer,
      contentType: input.file.mimetype,
    });

    const asset = await this.campaignMediaRepository.create({
      id: assetId,
      siteId: input.siteId,
      campaignId: null,
      kind: input.kind,
      originalName: sanitizeFileName(input.file.originalname),
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      storagePath,
      publicUrl,
    });

    return { id: asset.id, publicUrl: asset.publicUrl, kind: asset.kind };
  }

  // siteId omitted = every site (the centralized Media Library page); the
  // per-form gallery picker always passes one.
  async listGallery(filters: {
    siteId?: string | undefined;
    kind?: CampaignMediaKind | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<{
    items: CampaignMediaRecord[];
    total: number;
  }> {
    if (filters.siteId) {
      await this.sitesService.getSite(filters.siteId);
    }

    return this.campaignMediaRepository.listGallery({
      siteId: filters.siteId,
      kind: filters.kind,
      limit: filters.limit ?? 60,
      offset: filters.offset ?? 0,
    });
  }

  async getMediaFile(id: string): Promise<CampaignMediaRecord> {
    const asset = await this.campaignMediaRepository.findById(id);
    if (!asset) {
      throw new NotFoundException("Campaign media not found");
    }
    const exists = await this.campaignMediaStorage.exists(asset.storagePath);
    if (!exists) {
      throw new NotFoundException("Campaign media file not found");
    }

    return asset;
  }

  async openMediaFile(id: string): Promise<{ asset: CampaignMediaRecord; stream: Readable }> {
    const asset = await this.getMediaFile(id);
    const stream = await this.campaignMediaStorage.openReadStream(asset.storagePath);
    if (!stream) {
      throw new NotFoundException("Campaign media file not found");
    }

    return { asset, stream };
  }

  async resolveCampaignMedia(
    input: { imageAssetId?: string | null; iconAssetId?: string | null; imageUrl?: string | null; iconUrl?: string | null },
  ): Promise<{ imageUrl: string | null; iconUrl: string | null }> {
    const imageUrl = await this.resolveAssetUrl(input.imageAssetId, "image", input.imageUrl);
    const iconUrl = await this.resolveAssetUrl(input.iconAssetId, "icon", input.iconUrl);
    return { imageUrl, iconUrl };
  }

  async attachAssetsToCampaign(campaignId: string, assetIds: string[]): Promise<void> {
    for (const assetId of assetIds) {
      const asset = await this.campaignMediaRepository.attachToCampaign(assetId, campaignId);
      if (!asset) {
        throw new NotFoundException("Campaign media not found");
      }
    }
  }

  async cloneCampaignAssets(
    sourceCampaign: Pick<CampaignRecord, "id" | "imageUrl" | "iconUrl">,
    targetCampaignId: string,
  ): Promise<{ imageUrl: string | null; iconUrl: string | null }> {
    const assets = await this.campaignMediaRepository.listByCampaignId(sourceCampaign.id);
    const clonedUrls = {
      imageUrl: sourceCampaign.imageUrl,
      iconUrl: sourceCampaign.iconUrl,
    };
    for (const asset of assets) {
      const isCurrentImage = sourceCampaign.imageUrl === asset.publicUrl;
      const isCurrentIcon = sourceCampaign.iconUrl === asset.publicUrl;
      if (!isCurrentImage && !isCurrentIcon) {
        continue;
      }

      const clonedId = randomUUID();
      const extension = extname(asset.storagePath) || ".bin";
      const storagePath = `campaign-media/${clonedId}${extension}`;
      await this.campaignMediaStorage.copy({
        sourceKey: asset.storagePath,
        destinationKey: storagePath,
        contentType: asset.mimeType,
      });
      await this.campaignMediaRepository.create({
        id: clonedId,
        siteId: asset.siteId,
        campaignId: targetCampaignId,
        kind: asset.kind,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        storagePath,
        publicUrl: `${this.getApiBaseUrl().replace(/\/$/, "")}/campaign-media/${clonedId}/file`,
      });

      if (isCurrentImage) {
        clonedUrls.imageUrl = `${this.getApiBaseUrl().replace(/\/$/, "")}/campaign-media/${clonedId}/file`;
      }
      if (isCurrentIcon) {
        clonedUrls.iconUrl = `${this.getApiBaseUrl().replace(/\/$/, "")}/campaign-media/${clonedId}/file`;
      }
    }

    return clonedUrls;
  }

  async deleteCampaignAssets(campaignId: string): Promise<void> {
    const assets = await this.campaignMediaRepository.listByCampaignId(campaignId);
    for (const asset of assets) {
      await this.campaignMediaStorage.delete(asset.storagePath);
    }
    await this.campaignMediaRepository.deleteByIds(assets.map((asset) => asset.id));
  }

  async cleanupExpiredCampaignAssets(asOf: Date): Promise<number> {
    const assets = await this.campaignMediaRepository.listCleanupCandidates(asOf);
    for (const asset of assets) {
      await this.campaignMediaStorage.delete(asset.storagePath);
    }
    return this.campaignMediaRepository.deleteByIds(assets.map((asset) => asset.id));
  }

  async checkStorageHealth(): Promise<boolean> {
    return this.campaignMediaStorage.ping();
  }

  private async resolveAssetUrl(
    assetId: string | null | undefined,
    kind: CampaignMediaKind,
    fallbackUrl: string | null | undefined,
  ): Promise<string | null> {
    if (!assetId) {
      return fallbackUrl ?? null;
    }

    const asset = await this.campaignMediaRepository.findById(assetId);
    if (!asset) {
      throw new NotFoundException("Campaign media not found");
    }
    // Deliberately not restricted to the campaign's own site -- the media
    // library is shared across every site, so reusing an asset originally
    // uploaded under a different site is the whole point.
    if (asset.kind !== kind) {
      throw new BadRequestException(`Campaign media must be an ${kind}`);
    }

    return asset.publicUrl;
  }

  // This URL is embedded in every uploaded asset's publicUrl and served back
  // to browsers on completely different origins -- a silent fallback to
  // 127.0.0.1 here resolves to whichever machine is viewing the image, not
  // this server, so every upload "succeeds" but the image never renders
  // anywhere. Same shape as the browser-push ackBaseUrl bug: required,
  // rather than silently broken with no error pointing back to the cause.
  private getApiBaseUrl(): string {
    const value = process.env.PUBLIC_API_BASE_URL ?? process.env.API_PUBLIC_URL;
    if (!value || value.trim().length === 0) {
      throw new Error(
        "Missing required environment variable: set PUBLIC_API_BASE_URL (or API_PUBLIC_URL) to this server's " +
          "real public API URL, e.g. https://push.exotic-online.com/api",
      );
    }

    return value;
  }
}
