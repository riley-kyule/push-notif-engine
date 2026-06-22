import type { ContentTaxonomyListResult, ContentTaxonomyRecord } from "./campaign-taxonomies.types";

export interface CreateContentTaxonomyInput {
  slug: string;
  label: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface UpdateContentTaxonomyInput {
  label?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ContentTaxonomiesRepository {
  create(input: CreateContentTaxonomyInput): Promise<ContentTaxonomyRecord>;
  update(id: string, input: UpdateContentTaxonomyInput): Promise<ContentTaxonomyRecord | null>;
  findById(id: string): Promise<ContentTaxonomyRecord | null>;
  findBySlug(slug: string): Promise<ContentTaxonomyRecord | null>;
  list(): Promise<ContentTaxonomyListResult>;
  delete(id: string): Promise<boolean>;
}
