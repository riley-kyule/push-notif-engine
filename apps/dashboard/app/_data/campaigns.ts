export interface CampaignSummary {
  id: string;
  name: string;
  site: string;
  type: "instant" | "scheduled" | "recurring";
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

export const campaignSummaries: CampaignSummary[] = [
  {
    id: "launch-week",
    name: "Launch Week",
    site: "exotic-africa.com",
    type: "scheduled",
    status: "scheduled",
    sent: "0",
    ctr: "0%",
    scheduledAt: "2026-06-18 09:00",
  },
  {
    id: "safari-sale",
    name: "Safari Sale",
    site: "zebra-travel.co.za",
    type: "instant",
    status: "sent",
    sent: "184,311",
    ctr: "7.8%",
    scheduledAt: "Sent today",
  },
  {
    id: "weekly-roundup",
    name: "Weekly Roundup",
    site: "all sites",
    type: "recurring",
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
    site: "exotic-africa.com",
    type: "scheduled",
    status: "scheduled",
    sent: "0",
    ctr: "0%",
    scheduledAt: "2026-06-18 09:00",
    title: "Big Safari Sale",
    message: "Save 30% on the best last-minute wilderness stays.",
    url: "https://exotic-africa.com/offers/safari-sale",
    imageLabel: "Hero image",
    iconLabel: "Brand icon",
    buttons: [{ label: "View Deal", url: "https://exotic-africa.com/offers/safari-sale" }],
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
  "safari-sale": {
    id: "safari-sale",
    name: "Safari Sale",
    site: "zebra-travel.co.za",
    type: "instant",
    status: "sent",
    sent: "184,311",
    ctr: "7.8%",
    scheduledAt: "Sent today",
    title: "Safari Sale",
    message: "Travel deeper, spend less. Limited seats across Exotic destinations.",
    url: "https://zebra-travel.co.za/deals",
    imageLabel: "Hero image",
    iconLabel: "Brand icon",
    buttons: [{ label: "Book Now", url: "https://zebra-travel.co.za/deals" }],
    metrics: {
      sent: "184,311",
      delivered: "181,990",
      clicks: "14,187",
      ctr: "7.8%",
    },
    timeline: [
      { label: "Created", value: "June 15, 2026 08:10", tone: "neutral" },
      { label: "Sent", value: "June 16, 2026 09:00", tone: "success" },
      { label: "Click rate", value: "7.8% CTR", tone: "success" },
    ],
  },
  "weekly-roundup": {
    id: "weekly-roundup",
    name: "Weekly Roundup",
    site: "all sites",
    type: "recurring",
    status: "draft",
    sent: "0",
    ctr: "-",
    scheduledAt: "Draft",
    title: "Weekly Roundup",
    message: "A recurring digest for content highlights and offers.",
    url: "https://exotic.com/roundup",
    imageLabel: "Digest image",
    iconLabel: "Digest icon",
    buttons: [{ label: "Read More", url: "https://exotic.com/roundup" }],
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

function getApiBaseUrl(): string {
  return process.env.DASHBOARD_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
}

function toCampaignSummary(record: {
  id: string;
  name: string;
  siteId?: string;
  site?: string;
  type: CampaignSummary["type"];
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
}): CampaignDetail {
  const summary = toCampaignSummary(record);
  return {
    ...summary,
    id: record.id,
    name: record.name,
    site: summary.site,
    title: record.title,
    message: record.message,
    url: record.url,
    imageLabel: record.imageUrl ? "Hero image" : "Image not set",
    iconLabel: record.iconUrl ? "Brand icon" : "Icon not set",
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

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getCampaignList(): Promise<CampaignListPayload> {
  const response = await fetchJson<CampaignApiResponse<{ items: Array<CampaignSummary & { siteId?: string }> }>>(
    "/campaigns",
  );

  const items = response?.data.items?.map((item) => toCampaignSummary(item)) ?? campaignSummaries;
  return {
    items,
    total: items.length,
  };
}

export async function getCampaignById(id: string): Promise<CampaignDetail | null> {
  const response = await fetchJson<CampaignApiResponse<CampaignDetail & { siteId?: string }>>(`/campaigns/${id}`);
  if (response?.data) {
    return toCampaignDetail(response.data);
  }

  return campaignDetails[id] ?? null;
}
