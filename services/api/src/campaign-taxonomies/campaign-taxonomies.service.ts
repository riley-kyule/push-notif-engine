import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { CAMPAIGN_TAXONOMIES_REPOSITORY } from "./campaign-taxonomies.constants";
import type { ContentTaxonomiesRepository } from "./campaign-taxonomies.repository";
import { CreateContentTaxonomyDto } from "./dto/create-content-taxonomy.dto";
import { UpdateContentTaxonomyDto } from "./dto/update-content-taxonomy.dto";
import type { ContentTaxonomyListResult, ContentTaxonomyRecord } from "./campaign-taxonomies.types";

@Injectable()
export class CampaignTaxonomiesService {
  constructor(
    @Inject(CAMPAIGN_TAXONOMIES_REPOSITORY) private readonly repository: ContentTaxonomiesRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateContentTaxonomyDto, actorUserId?: string): Promise<ContentTaxonomyRecord> {
    const slug = this.normalizeSlug(dto.slug);
    if (!slug) {
      throw new BadRequestException("Taxonomy slug is required");
    }
    const existing = await this.repository.findBySlug(slug);
    if (existing) {
      throw new BadRequestException("A taxonomy with that slug already exists");
    }

    const taxonomy = await this.repository.create({
      slug,
      label: dto.label.trim(),
      description: this.normalizeDescription(dto.description),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "taxonomy.created",
      targetType: "taxonomy",
      targetId: taxonomy.id,
      metadata: { slug: taxonomy.slug, label: taxonomy.label },
    });

    return taxonomy;
  }

  async update(id: string, dto: UpdateContentTaxonomyDto, actorUserId?: string): Promise<ContentTaxonomyRecord> {
    const existing = await this.get(id);
    const updateInput: Parameters<ContentTaxonomiesRepository["update"]>[1] = {};
    if (dto.label !== undefined) {
      updateInput.label = dto.label.trim();
    }
    if (dto.description !== undefined) {
      updateInput.description = this.normalizeDescription(dto.description);
    }
    if (dto.isActive !== undefined) {
      updateInput.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      updateInput.sortOrder = dto.sortOrder;
    }

    const updated = await this.repository.update(existing.id, updateInput);

    if (!updated) {
      throw new NotFoundException("Taxonomy not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "taxonomy.updated",
      targetType: "taxonomy",
      targetId: updated.id,
      metadata: { changes: dto },
    });

    return updated;
  }

  async delete(id: string, actorUserId?: string): Promise<void> {
    const existing = await this.get(id);
    const deleted = await this.repository.delete(existing.id);
    if (!deleted) {
      throw new NotFoundException("Taxonomy not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "taxonomy.deleted",
      targetType: "taxonomy",
      targetId: existing.id,
      metadata: { slug: existing.slug, label: existing.label },
    });
  }

  async list(): Promise<ContentTaxonomyListResult> {
    return this.repository.list();
  }

  async listActive(): Promise<ContentTaxonomyRecord[]> {
    const result = await this.repository.list();
    return result.items.filter((item) => item.isActive);
  }

  async ensureActive(slug: string): Promise<void> {
    const taxonomy = await this.repository.findBySlug(slug);
    if (!taxonomy || !taxonomy.isActive) {
      throw new BadRequestException("Unknown or inactive content taxonomy");
    }
  }

  private async get(id: string): Promise<ContentTaxonomyRecord> {
    const taxonomy = await this.repository.findById(id);
    if (!taxonomy) {
      throw new NotFoundException("Taxonomy not found");
    }
    return taxonomy;
  }

  private normalizeSlug(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  private normalizeDescription(value: string | null | undefined): string | null {
    if (value === undefined) {
      return null;
    }
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
