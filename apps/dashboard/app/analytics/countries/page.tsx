import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import { getCountryPerformancePage, resolveAnalyticsRange, type CountryPerformanceSummary } from "../../_data/analytics";
import { getSiteChoices } from "../../_data/sites";
import { AnalyticsComparisonCard } from "../analytics-comparison-card";
import { AnalyticsPerformanceExplorer, type ExplorerSection } from "../analytics-performance-explorer";
import { AnalyticsRangePicker } from "../analytics-range-picker";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

const countryDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

// Subscriber country is stored as an ISO 3166-1 alpha-2 code (from the
// browser SDK / cf-ipcountry geo-IP fallback), plus the literal "Unknown"
// when neither is available -- DisplayNames throws on that, so it's passed
// through as-is rather than rendered as a fake country name.
function formatCountryName(code: string): string {
  if (code === "Unknown") {
    return code;
  }

  try {
    return countryDisplayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function aggregate(rows: CountryPerformanceSummary[]) {
  const totalSubscribers = rows.reduce((sum, row) => sum + row.totalSubscribers, 0);
  const totalDelivered = rows.reduce((sum, row) => sum + row.totalDelivered, 0);
  const totalSent = rows.reduce((sum, row) => sum + row.totalSent, 0);
  const totalClicked = rows.reduce((sum, row) => sum + row.totalClicked, 0);
  const successfullyHandedOff = totalSent + totalDelivered;
  return {
    totalSubscribers,
    totalDelivered,
    clickThroughRate: successfullyHandedOff > 0 ? Math.round((totalClicked / successfullyHandedOff) * 10000) / 100 : 0,
  };
}

export default async function CountryPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    siteId?: string;
    preset?: string;
    startDate?: string;
    endDate?: string;
    compareMode?: string;
    compareStartDate?: string;
    compareEndDate?: string;
  }>;
}) {
  const query = await searchParams;
  const { selectedPreset, range, compareMode, comparisonRange } = resolveAnalyticsRange(query);

  const [countryPerformance, comparisonCountryPerformance, sites] = await Promise.all([
    getCountryPerformancePage(range, query.siteId),
    comparisonRange ? getCountryPerformancePage(comparisonRange, query.siteId) : Promise.resolve(null),
    getSiteChoices(),
  ]);
  const realSites = sites.filter((site) => site.id !== "site-3");

  const section: ExplorerSection = {
    key: "country",
    label: "Countries",
    eyebrow: "Country performance",
    title: "Top regions by delivery volume",
    badge: "Live",
    metrics: [
      { key: "subscribers", label: "Subscribers", color: "#ea580c", format: "number", points: countryPerformance.map((item) => ({ label: formatCountryName(item.country), value: item.totalSubscribers })) },
      { key: "delivery", label: "Delivery rate", color: "#16a34a", format: "percent", points: countryPerformance.map((item) => ({ label: formatCountryName(item.country), value: item.deliveryRate })) },
      { key: "ctr", label: "CTR", color: "#0ea5e9", format: "percent", points: countryPerformance.map((item) => ({ label: formatCountryName(item.country), value: item.clickThroughRate })) },
    ],
    rowColumns: ["Country", "Subscribers", "Delivery rate", "CTR"],
    rows: countryPerformance.map((item) => ({
      primary: formatCountryName(item.country),
      secondary: `${formatNumber(item.totalSubscribers)} subscribers`,
      metrics: [
        { label: "Subscribers", value: formatNumber(item.totalSubscribers) },
        { label: "Delivery rate", value: formatPercent(item.deliveryRate) },
        { label: "CTR", value: formatPercent(item.clickThroughRate) },
      ],
    })),
  };

  const currentTotals = aggregate(countryPerformance);
  const comparisonTotals = comparisonCountryPerformance ? aggregate(comparisonCountryPerformance) : null;

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
      <section className="card analytics-panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Reporting window</p>
            <h3>{range.label}</h3>
          </div>
          <FilterSelect
            basePath="/analytics/countries"
            currentParams={{ days: String(range.days), siteId: query.siteId }}
            paramKey="siteId"
            allLabel="All sites"
            options={realSites.map((site) => ({ value: site.id, label: site.name }))}
          />
        </div>
        <AnalyticsRangePicker
          selectedPreset={selectedPreset}
          compareMode={compareMode}
          range={range}
          comparisonRange={comparisonRange}
          siteId={query.siteId ?? ""}
          campaignId={null}
          compact
        />
      </section>

      {comparisonTotals ? (
        <div style={{ marginBottom: 18 }}>
          <AnalyticsComparisonCard
            currentLabel={range.label}
            comparisonLabel={comparisonRange?.label ?? "Comparison period"}
            metrics={[
              { label: "Subscribers", current: formatNumber(currentTotals.totalSubscribers), comparison: formatNumber(comparisonTotals.totalSubscribers) },
              { label: "Delivered", current: formatNumber(currentTotals.totalDelivered), comparison: formatNumber(comparisonTotals.totalDelivered) },
              { label: "CTR", current: formatPercent(currentTotals.clickThroughRate), comparison: formatPercent(comparisonTotals.clickThroughRate) },
            ]}
          />
        </div>
      ) : null}

      <AnalyticsPerformanceExplorer sections={[section]} />
    </DashboardShell>
  );
}
