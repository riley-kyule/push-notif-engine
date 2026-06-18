import { apiJson } from "../../lib/server-api";

export interface SegmentChoice {
  id: string;
  siteId: string;
  name: string;
}

interface SegmentApiResponse<T> {
  success: true;
  data: T;
}

export async function getSegmentChoices(): Promise<SegmentChoice[]> {
  const response = await apiJson<SegmentApiResponse<{ items: Array<{ id: string; siteId: string; name: string; status: string }> }>>(
    "/segments",
  );

  const items = response?.data.items ?? [];
  return items.filter((segment) => segment.status === "active").map((segment) => ({ id: segment.id, siteId: segment.siteId, name: segment.name }));
}
