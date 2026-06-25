import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import { getCountryPerformancePage, normalizeDays } from "../../_data/analytics";
import { getSiteChoices } from "../../_data/sites";
import { AnalyticsDaysFilter } from "../analytics-days-filter";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function CountryPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; siteId?: string }>;
}) {
  const query = await searchParams;
  const days = normalizeDays(query.days);
  const [countryPerformance, sites] = await Promise.all([
    getCountryPerformancePage(days, query.siteId),
    getSiteChoices(),
  ]);
  const realSites = sites.filter((site) => site.id !== "site-3");

  const currentParams = { days: String(days), siteId: query.siteId };

  const section: ExplorerSection = {
    key: "country",
    label: "Countries",
    eyebrow: "Country performance",
    title: "Top regions by delivery volume",
    badge: "Live",
    metrics: [
      { key: "subscribers", label: "Subscribers", color: "#ea580c", format: "number", points: countryPerformance.map((item) => ({ label: item.country, value: item.totalSubscribers })) },
      { key: "delivery", label: "Delivery rate", color: "#16a34a", format: "percent", points: countryPerformance.map((item) => ({ label: item.country, value: item.deliveryRate })) },
      { key: "ctr", label: "CTR", color: "#0ea5e9", format: "percent", points: countryPerformance.map((item) => ({ label: item.country, value: item.clickThroughRate })) },
    ],
    rowColumns: ["Country", "Subscribers", "Delivery rate", "CTR"],
    rows: countryPerformance.map((item) => ({
      primary: item.country,
      secondary: `${formatNumber(item.totalSubscribers)} subscribers`,
      metrics: [
        { label: "Subscribers", value: formatNumber(item.totalSubscribers) },
        { label: "Delivery rate", value: formatPercent(item.deliveryRate) },
        { label: "CTR", value: formatPercent(item.clickThroughRate) },
      ],
    })),
  };

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Country performance"
      description="Delivery and engagement grouped by subscriber country."
      actions={
        <Link className="button secondary" href="/analytics">
          Back to analytics
        </Link>
      }
    >
      <AnalyticsPerformanceExplorer
        sections={[section]}
        controls={
          <>
            <AnalyticsDaysFilter basePath="/analytics/countries" currentParams={currentParams} days={days} />
            <FilterSelect
              basePath="/analytics/countries"
              currentParams={currentParams}
              paramKey="siteId"
              allLabel="All sites"
              options={realSites.map((site) => ({ value: site.id, label: site.name }))}
            />
          </>
        }
      />
    </DashboardShell>
  );
}
