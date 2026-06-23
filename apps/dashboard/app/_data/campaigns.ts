import { apiJson } from "../../lib/server-api";

export interface CampaignSummary {
  id: string;
  name: string;
  site: string;
  type: "instant" | "scheduled" | "recurring";
  contentType: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "expired";
  sent: string;
  ctr: string;
  scheduledAt: string;
}

export interface CampaignDetail extends CampaignSummary {
  title: string;
  message: string;
  url: string;
  imageLabel: string;
  iconLabel: string;
  audienceLabel: string;
  contentType: string;
  buttons: Array<{ label: string; url: string }>;
  metrics: {
    sent: string;
    delivered: string;
    clicks: string;
    ctr: string;
  };
  timeline: Array<{ label: string; value: string; tone: "success" | "warning" | "error" | "neutral" }>;
}

export interface CampaignListPayload {
  items: CampaignSummary[];
  total: number;
}

interface CampaignApiResponse<T> {
  success: true;
  data: T;
}

// Only rendered when the /campaigns API is unreachable.
export const campaignSummaries: CampaignSummary[] = [
  {
    id: "launch-week",
    name: "Launch Week",
    site: "example.com",
    type: "scheduled",
    contentType: "promotion",
    status: "scheduled",
    sent: "0",
    ctr: "0%",
    scheduledAt: "2026-06-18 09:00",
  },
  {
    id: "weekend-sale",
    name: "Weekend Sale",
    site: "example.org",
    type: "instant",
    contentType: "announcement",
    status: "sent",
    sent: "0",
    ctr: "0%",
    scheduledAt: "Sent today",
  },
  {
    id: "weekly-roundup",
    name: "Weekly Roundup",
    site: "all sites",
    type: "recurring",
    contentType: "digest",
    status: "draft",
    sent: "0",
    ctr: "-",
    scheduledAt: "Draft",
  },
];

export const campaignDetails: Record<string, CampaignDetail> = {
  "launch-week": {
    id: "launch-week",
    name: "Launch Week",
    site: "example.com",
    type: "scheduled",
    contentType: "promotion",
    status: "scheduled",
    sent: "0",
    ctr: "0%",
    scheduledAt: "2026-06-18 09:00",
    title: "Launch Week",
    message: "Sample campaign message shown while the API is unreachable.",
    url: "https://example.com/offers/launch-week",
    imageLabel: "Hero image",
    iconLabel: "Brand icon",
    audienceLabel: "All active subscribers",
    buttons: [{ label: "View Deal", url: "https://example.com/offers/launch-week" }],
    metrics: {
      sent: "0",
      delivered: "0",
      clicks: "0",
      ctr: "0%",
    },
    timeline: [
      { label: "Created", value: "June 16, 2026 10:40", tone: "neutral" },
      { label: "Scheduled", value: "June 18, 2026 09:00", tone: "warning" },
      { label: "Delivery", value: "Pending queue dispatch", tone: "neutral" },
    ],
  },
  "weekend-sale": {
    id: "weekend-sale",
    name: "Weekend Sale",
    site: "example.org",
    type: "instant",
    contentType: "announcement",
    status: "sent",
    sent: "0",
    ctr: "0%",
    scheduledAt: "Sent today",
    title: "Weekend Sale",
    message: "Sample campaign message shown while the API is unreachable.",
    url: "https://example.org/deals",
    imageLabel: "Hero image",
    iconLabel: "Brand icon",
    audienceLabel: "All active subscribers",
    buttons: [{ label: "Shop Now", url: "https://example.org/deals" }],
    metrics: {
      sent: "0",
      delivered: "0",
      clicks: "0",
      ctr: "0%",
    },
    timeline: [
      { label: "Created", value: "June 15, 2026 08:10", tone: "neutral" },
      { label: "Sent", value: "June 16, 2026 09:00", tone: "success" },
      { label: "Click rate", value: "No data", tone: "neutral" },
    ],
  },
  "weekly-roundup": {
    id: "weekly-roundup",
    name: "Weekly Roundup",
    site: "all sites",
    type: "recurring",
    contentType: "digest",
    status: "draft",
    sent: "0",
    ctr: "-",
    scheduledAt: "Draft",
    title: "Weekly Roundup",
    message: "A recurring digest for content highlights and offers.",
    url: "https://example.com/roundup",
    imageLabel: "Digest image",
    iconLabel: "Digest icon",
    audienceLabel: "All active subscribers",
    buttons: [{ label: "Read More", url: "https://example.com/roundup" }],
    metrics: {
      sent: "0",
      delivered: "0",
      clicks: "0",
      ctr: "-",
    },
    timeline: [
      { label: "Created", value: "June 14, 2026 16:20", tone: "neutral" },
      { label: "Status", value: "Draft awaiting approval", tone: "warning" },
      { label: "Recurrence", value: "Weekly on Monday", tone: "neutral" },
    ],
  },
};

function toCampaignSummary(record: {
  id: string;
  name: string;
  siteId?: string;
  site?: string;
  type: CampaignSummary["type"];
  contentType?: CampaignSummary["contentType"];
  status: CampaignSummary["status"];
  sentAt?: string | null;
  sent?: string;
  ctr?: string;
  scheduledAt?: string | null;
}): CampaignSummary {
  return {
    id: record.id,
    name: record.name,
    site: record.site ?? record.siteId ?? "all sites",
    type: record.type,
    contentType: record.contentType ?? "announcement",
    status: record.status,
    sent: record.sent ?? (record.sentAt ? "sent" : "0"),
    ctr: record.ctr ?? "0%",
    scheduledAt:
      record.scheduledAt ??
      (record.status === "draft" ? "Draft" : record.status === "sent" ? "Sent today" : "Scheduled"),
  };
}

function toCampaignDetail(record: {
  id: string;
  name: string;
  siteId?: string;
  site?: string;
  type: CampaignDetail["type"];
  contentType?: CampaignDetail["contentType"];
  status: CampaignDetail["status"];
  sent?: string;
  ctr?: string;
  scheduledAt?: string | null;
  title: string;
  message: string;
  url: string;
  imageUrl?: string | null;
  iconUrl?: string | null;
  buttons?: Array<{ label: string; url: string }>;
  metrics?: CampaignDetail["metrics"];
  timeline?: CampaignDetail["timeline"];
}, audienceLabel = "All active subscribers"): CampaignDetail {
  const summary = toCampaignSummary(record);
  return {
    ...summary,
    id: record.id,
    name: record.name,
    site: summary.site,
    contentType: record.contentType ?? summary.contentType,
    title: record.title,
    message: record.message,
    url: record.url,
    imageLabel: record.imageUrl ? "Hero image" : "Image not set",
    iconLabel: record.iconUrl ? "Brand icon" : "Icon not set",
    audienceLabel,
    buttons: record.buttons ?? [],
    metrics:
      record.metrics ?? {
        sent: summary.sent,
        delivered: summary.sent,
        clicks: "0",
        ctr: summary.ctr,
      },
    timeline:
      record.timeline ?? [
        { label: "Created", value: "Imported from API", tone: "neutral" },
        { label: "Status", value: record.status, tone: record.status === "sent" ? "success" : "warning" },
      ],
  };
}

async function resolveSegmentName(segmentId: string): Promise<string> {
  const response = await apiJson<CampaignApiResponse<{ name: string }>>(`/segments/${segmentId}`);
  return response?.data.name ?? "All active subscribers";
}

interface CampaignAnalyticsStats {
  sent: number;
  delivered: number;
  clicked: number;
  total: number;
  clickThroughRate: number;
}

async function resolveCampaignMetrics(campaignId: string): Promise<CampaignDetail["metrics"] | null> {
  const response = await apiJson<CampaignApiResponse<CampaignAnalyticsStats>>(`/analytics/campaigns/${campaignId}`);
  if (!response?.data || response.data.total === 0) {
    return null;
  }

  const { sent, delivered, clicked, clickThroughRate } = response.data;
  return {
    sent: (sent + delivered).toLocaleString(),
    delivered: delivered.toLocaleString(),
    clicks: clicked.toLocaleString(),
    ctr: `${clickThroughRate}%`,
  };
}

export async function getCampaignList(): Promise<CampaignListPayload> {
  const response = await apiJson<CampaignApiResponse<{ items: Array<CampaignSummary & { siteId?: string }> }>>(
    "/campaigns",
  );

  const items = response?.data.items?.map((item) => toCampaignSummary(item)) ?? campaignSummaries;
  return {
    items,
    total: items.length,
  };
}

export async function getCampaignById(id: string): Promise<CampaignDetail | null> {
  const response = await apiJson<CampaignApiResponse<CampaignDetail & { siteId?: string; segmentId?: string | null }>>(
    `/campaigns/${id}`,
  );
  if (response?.data) {
    const segmentId = response.data.segmentId;
    const [audienceLabel, liveMetrics] = await Promise.all([
      segmentId ? resolveSegmentName(segmentId) : Promise.resolve("All active subscribers"),
      resolveCampaignMetrics(id),
    ]);

    const detail = toCampaignDetail(response.data, audienceLabel);
    return liveMetrics ? { ...detail, metrics: liveMetrics } : detail;
  }

  return campaignDetails[id] ?? null;
}
