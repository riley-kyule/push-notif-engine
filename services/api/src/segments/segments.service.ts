import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service";
import { SitesService } from "../sites/sites.service";
import { normalizeSegmentDefinition } from "./segments.logic";
import { SEGMENTS_REPOSITORY } from "./segments.constants";
import type { SegmentDefinitionInput, SegmentListFilters, SegmentListResult, SegmentRecord } from "./segments.types";
import type { CreateSegmentInput, SegmentsRepository, UpdateSegmentInput } from "./segments.repository";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import { EstimateSegmentReachDto } from "./dto/estimate-segment-reach.dto";
import { ListSegmentsQueryDto } from "./dto/list-segments-query.dto";
import { UpdateSegmentDto } from "./dto/update-segment.dto";

function normalizeDescription(description: string | null | undefined): string | null {
  if (description === undefined || description === null) {
    return description ?? null;
  }

  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class SegmentsService {
  constructor(
    private readonly sitesService: SitesService,
    private readonly auditService: AuditService,
    @Inject(SEGMENTS_REPOSITORY) private readonly segmentsRepository: SegmentsRepository,
  ) {}

  async createSegment(dto: CreateSegmentDto, actorUserId?: string): Promise<SegmentRecord> {
    await this.sitesService.getSite(dto.siteId);
    const segment = await this.segmentsRepository.create(this.normalizeCreateInput(dto));
    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "segment.created",
      targetType: "segment",
      targetId: segment.id,
      metadata: { siteId: segment.siteId, name: segment.name },
    });
    return segment;
  }

  async updateSegment(id: string, dto: UpdateSegmentDto, actorUserId?: string): Promise<SegmentRecord> {
    const existing = await this.getSegment(id);
    const updated = await this.segmentsRepository.update(id, this.normalizeUpdateInput(existing, dto));
    if (!updated) {
      throw new NotFoundException("Segment not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "segment.updated",
      targetType: "segment",
      targetId: updated.id,
      metadata: { changes: dto },
    });

    return updated;
  }

  async getSegment(id: string): Promise<SegmentRecord> {
    const segment = await this.segmentsRepository.findById(id);
    if (!segment) {
      throw new NotFoundException("Segment not found");
    }

    return segment;
  }

  async listSegments(query: ListSegmentsQueryDto): Promise<SegmentListResult> {
    const filters: SegmentListFilters = {
      limit: query.limit,
      offset: query.offset,
    };

    if (query.siteId) {
      filters.siteId = query.siteId;
    }
    if (query.status) {
      filters.status = query.status;
    }

    return this.segmentsRepository.list(filters);
  }

  async deleteSegment(id: string, actorUserId?: string): Promise<void> {
    const existing = await this.getSegment(id);
    const deleted = await this.segmentsRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException("Segment not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "segment.deleted",
      targetType: "segment",
      targetId: id,
      metadata: { siteId: existing.siteId, name: existing.name },
    });
  }

  async estimateSegmentReach(dto: EstimateSegmentReachDto): Promise<{ siteId: string; estimatedReach: number }> {
    await this.sitesService.getSite(dto.siteId);
    const definition = this.normalizeDefinition(dto.definition);
    const estimatedReach = await this.segmentsRepository.estimateReach(dto.siteId, definition);

    return {
      siteId: dto.siteId,
      estimatedReach,
    };
  }

  async estimateSavedSegmentReach(id: string): Promise<{ segmentId: string; siteId: string; estimatedReach: number }> {
    const segment = await this.getSegment(id);
    const estimatedReach = await this.segmentsRepository.estimateReach(segment.siteId, segment.definition);

    return {
      segmentId: segment.id,
      siteId: segment.siteId,
      estimatedReach,
    };
  }

  private normalizeCreateInput(dto: CreateSegmentDto): CreateSegmentInput {
    return {
      siteId: dto.siteId,
      name: dto.name,
      description: normalizeDescription(dto.description),
      definition: this.normalizeDefinition(dto.definition),
      status: dto.status ?? "active",
    };
  }

  private normalizeUpdateInput(existing: SegmentRecord, dto: UpdateSegmentDto): UpdateSegmentInput {
    return {
      name: dto.name ?? existing.name,
      description: dto.description === undefined ? existing.description : normalizeDescription(dto.description),
      definition: dto.definition === undefined ? existing.definition : this.normalizeDefinition(dto.definition),
      status: dto.status ?? existing.status,
    };
  }

  private normalizeDefinition(definition: SegmentDefinitionInput): ReturnType<typeof normalizeSegmentDefinition> {
    try {
      const normalizedInput: SegmentDefinitionInput = {
        rules: definition.rules,
      };

      if (definition.matchMode !== undefined) {
        normalizedInput.matchMode = definition.matchMode;
      }

      return normalizeSegmentDefinition(normalizedInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid segment definition";
      throw new BadRequestException(message);
    }
  }
}
