import { apiJson } from "../../lib/server-api";

export interface CampaignTaxonomyChoice {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface CampaignTaxonomyApiResponse<T> {
  success: true;
  data: T;
}

const fallbackTaxonomies: CampaignTaxonomyChoice[] = [
  { id: "taxonomy-1", slug: "announcement", label: "Announcement", description: "General updates", isActive: true, sortOrder: 10 },
  { id: "taxonomy-2", slug: "promotion", label: "Promotion", description: "Offers and campaigns", isActive: true, sortOrder: 20 },
  { id: "taxonomy-3", slug: "editorial", label: "Editorial", description: "Story-driven content", isActive: true, sortOrder: 30 },
  { id: "taxonomy-4", slug: "digest", label: "Digest", description: "Roundups and summaries", isActive: true, sortOrder: 40 },
  { id: "taxonomy-5", slug: "alert", label: "Alert", description: "Urgent notices", isActive: true, sortOrder: 50 },
];

export async function getCampaignTaxonomyChoices(): Promise<CampaignTaxonomyChoice[]> {
  const response = await apiJson<CampaignTaxonomyApiResponse<{ items: CampaignTaxonomyChoice[] }>>("/campaign-taxonomies");
  const items = response?.data.items ?? fallbackTaxonomies;
  return [...items]
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export async function getCampaignTaxonomies(): Promise<CampaignTaxonomyChoice[]> {
  const response = await apiJson<CampaignTaxonomyApiResponse<{ items: CampaignTaxonomyChoice[] }>>("/campaign-taxonomies");
  const items = response?.data.items ?? fallbackTaxonomies;
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function getFallbackCampaignTaxonomies(): CampaignTaxonomyChoice[] {
  return fallbackTaxonomies;
}
