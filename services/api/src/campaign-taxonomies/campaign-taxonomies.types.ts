export interface ContentTaxonomyRecord {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentTaxonomyListResult {
  items: ContentTaxonomyRecord[];
  total: number;
}
