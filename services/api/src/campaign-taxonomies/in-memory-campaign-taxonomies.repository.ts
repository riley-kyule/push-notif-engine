import crypto from "node:crypto";

import type {
  ContentTaxonomiesRepository,
  CreateContentTaxonomyInput,
  UpdateContentTaxonomyInput,
} from "./campaign-taxonomies.repository";
import type { ContentTaxonomyListResult, ContentTaxonomyRecord } from "./campaign-taxonomies.types";

export class InMemoryContentTaxonomiesRepository implements ContentTaxonomiesRepository {
  private readonly items = new Map<string, ContentTaxonomyRecord>();

  async create(input: CreateContentTaxonomyInput): Promise<ContentTaxonomyRecord> {
    const now = new Date();
    const record: ContentTaxonomyRecord = {
      id: crypto.randomUUID(),
      slug: input.slug,
      label: input.label,
      description: input.description,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(record.id, record);
    return record;
  }

  async update(id: string, input: UpdateContentTaxonomyInput): Promise<ContentTaxonomyRecord | null> {
    const existing = this.items.get(id);
    if (!existing) {
      return null;
    }

    const updated: ContentTaxonomyRecord = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<ContentTaxonomyRecord | null> {
    return this.items.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<ContentTaxonomyRecord | null> {
    return Array.from(this.items.values()).find((item) => item.slug === slug) ?? null;
  }

  async list(): Promise<ContentTaxonomyListResult> {
    const items = Array.from(this.items.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    return { items, total: items.length };
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}
