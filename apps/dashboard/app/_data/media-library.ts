import { apiJson } from "../../lib/server-api";

export interface MediaAsset {
  id: string;
  siteId: string;
  campaignId: string | null;
  kind: "image" | "icon";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: string;
}

export interface MediaLibraryFilters {
  siteId?: string | undefined;
  kind?: "image" | "icon" | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface MediaLibraryPayload {
  items: MediaAsset[];
  total: number;
}

export async function getMediaLibrary(filters: MediaLibraryFilters = {}): Promise<MediaLibraryPayload> {
  const search = new URLSearchParams();
  if (filters.siteId) search.set("siteId", filters.siteId);
  if (filters.kind) search.set("kind", filters.kind);
  search.set("limit", String(filters.limit ?? 60));
  search.set("offset", String(filters.offset ?? 0));

  const response = await apiJson<{ success: true; data: MediaLibraryPayload }>(`/campaign-media?${search.toString()}`);
  if (!response?.data?.items) {
    return { items: [], total: 0 };
  }

  return response.data;
}
