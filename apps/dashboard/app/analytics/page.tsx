import Link from "next/link";

import { DashboardShell } from "../_components/dashboard-shell";
import { formatTimeBucketLabel, getAnalyticsDashboardData } from "../_data/analytics";
import { AnalyticsRangePicker } from "./analytics-range-picker";
import { buildAnalyticsOverviewCards } from "./analytics-overview";
import { AnalyticsPerformanceExplorer, type ExplorerSection, type ExportSectionOptions } from "./analytics-performance-explorer";

function buildQuery(params: {
  preset: string;
  days: number;
  section?: string;
  metric?: string;
  startDate?: string;
  endDate?: string;
  compareMode?: string;
  compareStartDate?: string;
  compareEndDate?: string;
  siteId?: string;
  campaignId?: string;
}): string {
  const search = new URLSearchParams();
  search.set("preset", params.preset);
  search.set("days", String(params.days));
  if (params.section) {
    search.set("section", params.section);
  }
  if (params.metric) {
    search.set("metric", params.metric);
  }
  if (params.startDate) {
    search.set("startDate", params.startDate);
  }
  if (params.endDate) {
    search.set("endDate", params.endDate);
  }
  if (params.compareMode) {
    search.set("compareMode", params.compareMode);
  }
  if (params.compareStartDate) {
    search.set("compareStartDate", params.compareStartDate);
  }
  if (params.compareEndDate) {
    search.set("compareEndDate", params.compareEndDate);
  }
  if (params.siteId) {
    search.set("siteId", params.siteId);
  }
  if (params.campaignId) {
    search.set("campaignId", params.campaignId);
  }
  return `/analytics?${search.toString()}`;
}

function buildExportUrl(params: {
  days: number;
  report: "overview" | "countries" | "sites-performance" | "time-performance" | "content-performance";
  format?: "csv" | "xlsx" | "pdf";
}): string {
  const search = new URLSearchParams({
    days: String(params.days),
    report: params.report,
  });
  if (params.format) {
    search.set("format", params.format);
  }
  return `/api/dashboard/analytics/export?${search.toString()}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; preset?: string; section?: string; metric?: string; startDate?: string; endDate?: string; compareMode?: string; compareStartDate?: string; compareEndDate?: string; siteId?: string; campaignId?: string }>;
}) {
  const query = await searchParams;
  const dashboard = await getAnalyticsDashboardData(query);
  const activeSection = typeof query.section === "string" ? query.section : "site";
  const activeMetric = typeof query.metric === "string" ? query.metric : undefined;
  const currentFilters = {
    preset: dashboard.selectedPreset,
    days: dashboard.days,
    ...(dashboard.selectedPreset === "custom" && dashboard.range.days > 1 ? { endDate: dashboard.range.endDate } : {}),
    ...(dashboard.selectedPreset === "custom" ? { startDate: dashboard.range.startDate } : {}),
    compareMode: dashboard.compareMode,
    ...(dashboard.compareMode === "custom" && dashboard.comparisonRange
      ? {
          compareStartDate: dashboard.comparisonRange.startDate,
          compareEndDate: dashboard.comparisonRange.endDate,
        }
      : {}),
    siteId: dashboard.selectedSite.id,
    ...(dashboard.selectedCampaign ? { campaignId: dashboard.selectedCampaign.id } : {}),
    section: activeSection,
    ...(activeMetric ? { metric: activeMetric } : {}),
  };
  const overviewCards = buildAnalyticsOverviewCards(dashboard.overview, {
    failureHref:
      buildQuery({
        preset: dashboard.selectedPreset,
        days: dashboard.days,
        ...(dashboard.selectedPreset === "custom" && dashboard.range.days > 1 ? { endDate: dashboard.range.endDate } : {}),
        ...(dashboard.selectedPreset === "custom" ? { startDate: dashboard.range.startDate } : {}),
        compareMode: dashboard.compareMode,
        ...(dashboard.compareMode === "custom" && dashboard.comparisonRange
          ? {
              compareStartDate: dashboard.comparisonRange.startDate,
              compareEndDate: dashboard.comparisonRange.endDate,
            }
          : {}),
        siteId: dashboard.selectedSite.id,
        ...(dashboard.selectedCampaign ? { campaignId: dashboard.selectedCampaign.id } : {}),
        section: "failures",
      }) + "#analytics-performance-explorer",
  });

  const buildSeries = <T,>(
    data: T[],
    getLabel: (item: T) => string,
    definitions: { key: string; label: string; color: string; getValue: (item: T) => number; format?: "number" | "percent" }[],
  ) =>
    definitions.map((definition) => ({
      key: definition.key,
      label: definition.label,
      color: definition.color,
      format: definition.format ?? "number",
      points: data.map((item) => ({ label: getLabel(item), value: definition.getValue(item) })),
    }));

  const performanceSections: ExplorerSection[] = [
    {
      key: "failures",
      label: "Failures",
      eyebrow: "Failure report",
      title: "Failed deliveries over time",
      badge: "Reason + trend",
      metrics: buildSeries(dashboard.timePerformance, (item) => formatTimeBucketLabel(item.bucket, dashboard.days), [
        { key: "failed", label: "Failures", color: "#dc2626", getValue: (item) => item.totalFailed, format: "number" },
      ]),
      summary: [
        { label: "Failed deliveries", value: formatNumber(dashboard.overview.totalFailed) },
        {
          label: "Top reason",
          value: dashboard.overview.failedDeliveryReason ?? "No failure reason recorded",
        },
        {
          label: "Reason events",
          value:
            dashboard.overview.failedDeliveryReasonCount > 0
              ? `${formatNumber(dashboard.overview.failedDeliveryReasonCount)} events`
              : "0 events",
        },
      ],
      rowColumns: ["Date", "Failed"],
      rows: dashboard.timePerformance.map((item) => ({
        primary: formatTimeBucketLabel(item.bucket, dashboard.days),
        secondary: "Failure trend",
        metrics: [{ label: "Failed", value: formatNumber(item.totalFailed) }],
      })),
    },
    {
      key: "site",
      label: "Site",
      eyebrow: "Site performance",
      title: dashboard.selectedSite.name,
      badge: dashboard.selectedSite.status,
      metrics: buildSeries(dashboard.sitePerformance, (item) => item.siteName, [
        { key: "subscribers", label: "Subscribers", color: "#ea580c", getValue: (item) => item.totalSubscribers, format: "number" },
        { key: "delivery", label: "Delivery rate", color: "#16a34a", getValue: (item) => item.deliveryRate, format: "percent" },
        { key: "ctr", label: "CTR", color: "#0ea5e9", getValue: (item) => item.clickThroughRate, format: "percent" },
      ]),
      summary: [
        { label: "Total subscribers", value: formatNumber(dashboard.siteAnalytics.totalSubscribers) },
        { label: "Active subscribers", value: formatNumber(dashboard.siteAnalytics.activeSubscribers) },
        {
          label: "Delivery rate",
          value:
            dashboard.siteAnalytics.last30Days.totalDelivered > 0
              ? formatPercent(
                  Math.round(
                    (dashboard.siteAnalytics.last30Days.totalDelivered / Math.max(dashboard.siteAnalytics.last30Days.totalSent, 1)) * 10000,
                  ) / 100,
                )
              : "0%",
        },
      ],
      selector: {
        action: "/analytics",
        label: "Site",
        selectedValue: dashboard.selectedSite.id,
        hiddenInputs: [
          { name: "preset", value: dashboard.selectedPreset },
          { name: "days", value: String(dashboard.days) },
          ...(dashboard.selectedPreset === "custom" && dashboard.range.days > 1 ? [{ name: "endDate", value: dashboard.range.endDate }] : []),
          ...(dashboard.selectedPreset === "custom" ? [{ name: "startDate", value: dashboard.range.startDate }] : []),
          { name: "compareMode", value: dashboard.compareMode },
          ...(dashboard.compareMode === "custom" && dashboard.comparisonRange
            ? [
                { name: "compareStartDate", value: dashboard.comparisonRange.startDate },
                { name: "compareEndDate", value: dashboard.comparisonRange.endDate },
              ]
            : []),
          { name: "campaignId", value: dashboard.selectedCampaign?.id ?? "" },
        ],
        options: [
          { value: "site-3", label: "All Sites" },
          ...dashboard.sites
            .filter((site) => site.id !== "site-3")
            .map((site) => ({ value: site.id, label: `${site.name} - ${site.country}` })),
        ],
      },
      rowColumns: ["Site", "Subscribers", "Delivery rate", "CTR"],
      rows: dashboard.sitePerformance.map((item) => ({
        primary: item.siteName,
        secondary: item.siteId,
        metrics: [
          { label: "Subscribers", value: formatNumber(item.totalSubscribers) },
          { label: "Delivery rate", value: formatPercent(item.deliveryRate) },
          { label: "CTR", value: formatPercent(item.clickThroughRate) },
        ],
      })),
    },
    {
      key: "country",
      label: "Country",
      eyebrow: "Country performance",
      title: "Top regions by delivery volume",
      badge: "Live",
      metrics: buildSeries(dashboard.countryPerformance, (item) => item.country, [
        { key: "subscribers", label: "Subscribers", color: "#ea580c", getValue: (item) => item.totalSubscribers, format: "number" },
        { key: "delivery", label: "Delivery rate", color: "#16a34a", getValue: (item) => item.deliveryRate, format: "percent" },
        { key: "ctr", label: "CTR", color: "#0ea5e9", getValue: (item) => item.clickThroughRate, format: "percent" },
      ]),
      rowColumns: ["Country", "Subscribers", "Delivery rate", "CTR"],
      rows: dashboard.countryPerformance.map((item) => ({
        primary: item.country,
        secondary: `${formatNumber(item.totalSubscribers)} subscribers`,
        metrics: [
          { label: "Subscribers", value: formatNumber(item.totalSubscribers) },
          { label: "Delivery rate", value: formatPercent(item.deliveryRate) },
          { label: "CTR", value: formatPercent(item.clickThroughRate) },
        ],
      })),
    },
    {
      key: "time",
      label: "Time",
      eyebrow: "Time performance",
      title: dashboard.days <= 1 ? "Delivery volume by hour" : "Delivery volume over time",
      badge: "UTC",
      metrics: buildSeries(dashboard.timePerformance, (item) => formatTimeBucketLabel(item.bucket, dashboard.days), [
        { key: "delivered", label: "Delivered", color: "#ea580c", getValue: (item) => item.totalDelivered, format: "number" },
        { key: "sent", label: "Sent", color: "#0ea5e9", getValue: (item) => item.totalSent, format: "number" },
        { key: "failed", label: "Failed", color: "#dc2626", getValue: (item) => item.totalFailed, format: "number" },
        { key: "clicked", label: "Clicked", color: "#16a34a", getValue: (item) => item.totalClicked, format: "number" },
        { key: "delivery-rate", label: "Delivery rate", color: "#16a34a", getValue: (item) => item.deliveryRate, format: "percent" },
        { key: "ctr", label: "CTR", color: "#0ea5e9", getValue: (item) => item.clickThroughRate, format: "percent" },
      ]),
      rowColumns: [dashboard.days <= 1 ? "Hour" : "Date", "Sent", "Delivered", "CTR"],
      rows: dashboard.timePerformance.map((item) => ({
        primary: formatTimeBucketLabel(item.bucket, dashboard.days),
        secondary: `${item.totalFailed} failed`,
        metrics: [
          { label: "Sent", value: formatNumber(item.totalSent) },
          { label: "Delivered", value: formatNumber(item.totalDelivered) },
          { label: "CTR", value: formatPercent(item.clickThroughRate) },
        ],
      })),
    },
    {
      key: "content",
      label: "Content",
      eyebrow: "Content performance",
      title: "Content performance by campaign type",
      badge: "Campaign types",
      metrics: buildSeries(dashboard.contentPerformance, (item) => item.contentType, [
        { key: "campaigns", label: "Campaigns", color: "#ea580c", getValue: (item) => item.totalCampaigns, format: "number" },
        { key: "delivered", label: "Delivered", color: "#0ea5e9", getValue: (item) => item.totalDelivered, format: "number" },
        { key: "delivery", label: "Delivery rate", color: "#16a34a", getValue: (item) => item.deliveryRate, format: "percent" },
        { key: "ctr", label: "CTR", color: "#0ea5e9", getValue: (item) => item.clickThroughRate, format: "percent" },
      ]),
      rowColumns: ["Type", "Campaigns", "Delivery rate", "CTR"],
      rows: dashboard.contentPerformance.map((item) => ({
        primary: item.contentType,
        secondary: `${formatNumber(item.totalCampaigns)} campaigns`,
        metrics: [
          { label: "Campaigns", value: formatNumber(item.totalCampaigns) },
          { label: "Delivery rate", value: formatPercent(item.deliveryRate) },
          { label: "CTR", value: formatPercent(item.clickThroughRate) },
        ],
      })),
    },
  ];

  const sectionReportKeys: Record<string, "sites-performance" | "countries" | "time-performance" | "content-performance"> = {
    failures: "time-performance",
    site: "sites-performance",
    country: "countries",
    time: "time-performance",
    content: "content-performance",
  };

  const exportOptions: Record<string, ExportSectionOptions> = Object.fromEntries(
    Object.entries(sectionReportKeys).map(([sectionKey, report]) => [
      sectionKey,
      {
        csv: buildExportUrl({ days: dashboard.days, report, format: "csv" }),
        xlsx: buildExportUrl({ days: dashboard.days, report, format: "xlsx" }),
        pdf: buildExportUrl({ days: dashboard.days, report, format: "pdf" }),
        googleSheetsAuthorizeUrl: `/api/dashboard/analytics/export/google-sheets/authorize?report=${report}&days=${dashboard.days}`,
      },
    ]),
  );

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Reporting command center"
      description="Track delivery health, subscriber growth, and campaign performance from a single reporting surface."
      actions={
        <>
          <Link className="button secondary" href="/campaigns/new">
            New campaign
          </Link>
          <Link className="button primary" href={buildQuery(currentFilters)}>
            Refresh data
          </Link>
        </>
      }
      >
      <div className="analytics-page">
        <section className="analytics-summary-grid">
          {overviewCards.map((item) => (
            item.href ? (
              <Link key={item.label} className="card analytics-summary-card overview-summary-link" href={item.href} aria-label={`${item.label}: ${item.value}`}>
                <p className="analytics-summary-label">{item.label}</p>
                <p className="analytics-summary-value">{item.value}</p>
                <p className="analytics-summary-detail">{item.detail}</p>
                <span className="overview-summary-cta">View details →</span>
              </Link>
            ) : (
              <article key={item.label} className="card analytics-summary-card">
                <p className="analytics-summary-label">{item.label}</p>
                <p className="analytics-summary-value">{item.value}</p>
                <p className="analytics-summary-detail">{item.detail}</p>
              </article>
            )
          ))}
        </section>

        <AnalyticsPerformanceExplorer
          sections={performanceSections}
          initialSectionKey={activeSection}
          initialMetricKey={activeMetric}
          exportOptions={exportOptions}
          controls={
            <AnalyticsRangePicker
              selectedPreset={dashboard.selectedPreset}
              compareMode={dashboard.compareMode}
              range={dashboard.range}
              comparisonRange={dashboard.comparisonRange}
              siteId={dashboard.selectedSite.id}
              campaignId={dashboard.selectedCampaign?.id ?? null}
              compact
            />
          }
        />

        {dashboard.comparisonOverview && dashboard.comparisonRange ? (
          <section className="card analytics-comparison-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Range comparison</p>
                <h3>
                  {dashboard.rangeLabel} vs {dashboard.comparisonRange.label}
                </h3>
              </div>
              <span className="badge active">Side by side</span>
            </div>

            <div className="analytics-comparison-grid">
              <article className="analytics-comparison-block">
                <p className="subtle">Selected range</p>
                <strong>{dashboard.rangeLabel}</strong>
                <dl className="analytics-comparison-metrics">
                  <div>
                    <dt>Subscribers</dt>
                    <dd>{formatNumber(dashboard.overview.totalSubscribers)}</dd>
                  </div>
                  <div>
                    <dt>Delivered</dt>
                    <dd>{formatNumber(dashboard.overview.totalDelivered)}</dd>
                  </div>
                  <div>
                    <dt>Clicks</dt>
                    <dd>{formatNumber(dashboard.overview.totalClicked)}</dd>
                  </div>
                  <div>
                    <dt>CTR</dt>
                    <dd>{formatPercent(dashboard.overview.clickThroughRate)}</dd>
                  </div>
                </dl>
              </article>
              <article className="analytics-comparison-block">
                <p className="subtle">Comparison range</p>
                <strong>{dashboard.comparisonRange.label}</strong>
                <dl className="analytics-comparison-metrics">
                  <div>
                    <dt>Subscribers</dt>
                    <dd>{formatNumber(dashboard.comparisonOverview.totalSubscribers)}</dd>
                  </div>
                  <div>
                    <dt>Delivered</dt>
                    <dd>{formatNumber(dashboard.comparisonOverview.totalDelivered)}</dd>
                  </div>
                  <div>
                    <dt>Clicks</dt>
                    <dd>{formatNumber(dashboard.comparisonOverview.totalClicked)}</dd>
                  </div>
                  <div>
                    <dt>CTR</dt>
                    <dd>{formatPercent(dashboard.comparisonOverview.clickThroughRate)}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>
        ) : null}

        <section className="analytics-report-grid">
          <section className="card analytics-panel analytics-report-main">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Campaign performance</p>
                <h3>{dashboard.selectedCampaign?.name ?? "No campaign selected"}</h3>
              </div>
              <span className={`badge ${dashboard.selectedCampaign?.status ?? "draft"}`}>{dashboard.selectedCampaign?.status ?? "draft"}</span>
            </div>

            <form className="analytics-selectors analytics-selectors--stacked" action="/analytics" method="get">
              <input type="hidden" name="preset" value={dashboard.selectedPreset} />
              <input type="hidden" name="days" value={String(dashboard.days)} />
              {dashboard.selectedPreset === "custom" && dashboard.range.days > 1 ? (
                <input type="hidden" name="endDate" value={dashboard.range.endDate} />
              ) : null}
              {dashboard.selectedPreset === "custom" ? <input type="hidden" name="startDate" value={dashboard.range.startDate} /> : null}
              <input type="hidden" name="compareMode" value={dashboard.compareMode} />
              {dashboard.compareMode === "custom" && dashboard.comparisonRange ? (
                <>
                  <input type="hidden" name="compareStartDate" value={dashboard.comparisonRange.startDate} />
                  <input type="hidden" name="compareEndDate" value={dashboard.comparisonRange.endDate} />
                </>
              ) : null}
              <input type="hidden" name="siteId" value={dashboard.selectedSite.id} />
              <div className="field">
                <label htmlFor="analytics-campaign">Campaign</label>
                <select id="analytics-campaign" name="campaignId" className="select" defaultValue={dashboard.selectedCampaign?.id ?? ""}>
                  {dashboard.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} - {campaign.status}
                    </option>
                  ))}
                </select>
              </div>
              <button className="button secondary" type="submit">
                View campaign
              </button>
            </form>

            {dashboard.selectedCampaign ? (
              <div className="analytics-campaign-card">
                <p className="subtle">{dashboard.selectedCampaign.site}</p>
                <p>{dashboard.selectedCampaign.message}</p>
                <div className="analytics-mini-summary analytics-mini-summary--compact">
                  <article className="analytics-mini-card">
                    <span>Sent</span>
                    <strong>{dashboard.selectedCampaign.metrics.sent}</strong>
                  </article>
                  <article className="analytics-mini-card">
                    <span>Delivered</span>
                    <strong>{dashboard.selectedCampaign.metrics.delivered}</strong>
                  </article>
                  <article className="analytics-mini-card">
                    <span>Clicks</span>
                    <strong>{dashboard.selectedCampaign.metrics.clicks}</strong>
                  </article>
                  <article className="analytics-mini-card">
                    <span>CTR</span>
                    <strong>{dashboard.selectedCampaign.metrics.ctr}</strong>
                  </article>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="card analytics-panel analytics-report-side">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Selected site</p>
                <h3>{dashboard.selectedSite.name}</h3>
              </div>
              <span className="badge active">{dashboard.selectedSite.status}</span>
            </div>

            <div className="analytics-site-summary">
              <article className="analytics-site-summary-card">
                <span>Subscribers</span>
                <strong>{formatNumber(dashboard.siteAnalytics.totalSubscribers)}</strong>
              </article>
              <article className="analytics-site-summary-card">
                <span>Active</span>
                <strong>{formatNumber(dashboard.siteAnalytics.activeSubscribers)}</strong>
              </article>
              <article className="analytics-site-summary-card">
                <span>Delivered 30d</span>
                <strong>{formatNumber(dashboard.siteAnalytics.last30Days.totalDelivered)}</strong>
              </article>
              <article className="analytics-site-summary-card">
                <span>Failures 30d</span>
                <strong>{formatNumber(dashboard.siteAnalytics.last30Days.totalFailed)}</strong>
              </article>
            </div>

            <div className="analytics-drilldown-links">
              <Link className="button secondary" href={`/sites/${dashboard.selectedSite.id}`}>
                Open site
              </Link>
              <Link className="button secondary" href="/segments">
                Segments
              </Link>
              <Link className="button secondary" href="/workflow">
                Workflow
              </Link>
              <Link className="button secondary" href="/analytics?section=site&days=30&preset=30d">
                Site report
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </DashboardShell>
  );
}
