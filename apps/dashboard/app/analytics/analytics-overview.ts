import type { DashboardOverview } from "../_data/overview";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export function buildAnalyticsOverviewCards(overview: DashboardOverview, options?: { failureHref?: string }) {
  return [
    {
      label: "Total subscribers",
      value: formatNumber(overview.totalSubscribers),
      detail: `Across ${overview.totalSites} sites`,
    },
    {
      label: "Delivered",
      value: formatNumber(overview.totalDelivered),
      detail: "In the selected reporting window",
    },
    {
      label: "Clicks",
      value: formatNumber(overview.totalClicked),
      detail: `CTR ${formatPercent(overview.clickThroughRate)}`,
    },
    {
      label: "Failures",
      value: formatNumber(overview.totalFailed),
      detail: overview.failedDeliveryReason
        ? `Most common cause: ${overview.failedDeliveryReason} (${formatNumber(overview.failedDeliveryReasonCount)} events)`
        : "Queue and delivery exceptions",
      href: overview.failedDeliveryReason ? options?.failureHref : undefined,
    },
  ];
}
