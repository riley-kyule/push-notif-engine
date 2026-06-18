import crypto from "node:crypto";

import type { SubscribersRepository } from "../subscribers/subscribers.repository";
import type { SubscriberRecord } from "../subscribers/subscribers.types";
import type { SegmentDefinition, SegmentListFilters, SegmentListResult, SegmentRecord } from "./segments.types";
import type { CreateSegmentInput, SegmentsRepository, UpdateSegmentInput } from "./segments.repository";
import { matchesSegmentDefinition } from "./segments.logic";

export class InMemorySegmentsRepository implements SegmentsRepository {
  private readonly segments = new Map<string, SegmentRecord>();

  constructor(private readonly subscribersRepository: Pick<SubscribersRepository, "list"> & { seed?: SubscriberRecord[] } = { list: async () => ({ items: [], total: 0 }) }) {}

  async create(input: CreateSegmentInput): Promise<SegmentRecord> {
    const now = new Date();
    const segment: SegmentRecord = {
      id: crypto.randomUUID(),
      siteId: input.siteId,
      name: input.name,
      description: input.description,
      definition: input.definition,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    this.segments.set(segment.id, segment);
    return segment;
  }

  async update(id: string, input: UpdateSegmentInput): Promise<SegmentRecord | null> {
    const existing = this.segments.get(id);
    if (!existing) {
      return null;
    }

    const updated: SegmentRecord = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      definition: input.definition ?? existing.definition,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
    };

    this.segments.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<SegmentRecord | null> {
    return this.segments.get(id) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    return this.segments.delete(id);
  }

  async list(filters: SegmentListFilters): Promise<SegmentListResult> {
    const items = Array.from(this.segments.values()).filter((segment) => {
      if (filters.siteId && segment.siteId !== filters.siteId) {
        return false;
      }
      if (filters.status && segment.status !== filters.status) {
        return false;
      }
      return true;
    });

    items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      items: items.slice(filters.offset, filters.offset + filters.limit),
      total: items.length,
    };
  }

  async estimateReach(siteId: string, definition: SegmentDefinition): Promise<number> {
    const result = await this.subscribersRepository.list({
      siteId,
      limit: 1000000,
      offset: 0,
    } as never);

    return result.items.filter((subscriber) => matchesSegmentDefinition(subscriber, definition)).length;
  }
}
