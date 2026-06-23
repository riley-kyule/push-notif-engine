import { apiJson } from "../../lib/server-api";

export type SegmentStatus = "active" | "archived";
export type SegmentMatchMode = "all" | "any";

export interface SegmentSummary {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  status: SegmentStatus;
  matchMode: SegmentMatchMode;
  ruleCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SegmentApiRecord extends SegmentSummary {
  definition?: { matchMode?: SegmentMatchMode; rules?: unknown[] };
}

interface SegmentApiResponse<T> {
  success: true;
  data: T;
}

const fallbackSegments: SegmentSummary[] = [
  {
    id: "segment-1",
    siteId: "site-1",
    name: "Mobile subscribers",
    description: "Subscribers on a mobile device",
    status: "active",
    matchMode: "all",
    ruleCount: 2,
    createdAt: "2026-06-20T08:00:00.000Z",
    updatedAt: "2026-06-20T08:00:00.000Z",
  },
  {
    id: "segment-2",
    siteId: "site-2",
    name: "Recent Firefox readers",
    description: "Recently active Firefox subscribers",
    status: "active",
    matchMode: "any",
    ruleCount: 2,
    createdAt: "2026-06-19T08:00:00.000Z",
    updatedAt: "2026-06-19T08:00:00.000Z",
  },
];

export async function getSegmentSummaries(): Promise<SegmentSummary[]> {
  const response = await apiJson<SegmentApiResponse<{ items: SegmentApiRecord[] }>>("/segments");
  const items = (response?.data.items ?? fallbackSegments) as SegmentApiRecord[];
  return items.map((segment) => ({
    id: segment.id,
    siteId: segment.siteId,
    name: segment.name,
    description: segment.description ?? null,
    status: segment.status,
    matchMode: segment.matchMode ?? segment.definition?.matchMode ?? "all",
    ruleCount: segment.ruleCount ?? (Array.isArray(segment.definition?.rules) ? segment.definition.rules.length : 0),
    createdAt: segment.createdAt,
    updatedAt: segment.updatedAt,
  }));
}

export function getFallbackSegmentSummaries(): SegmentSummary[] {
  return fallbackSegments;
}
