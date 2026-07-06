import Link from "next/link";

import { DashboardShell } from "../../_components/dashboard-shell";
import { FilterSelect } from "../../_components/list-controls";
import { getCampaignList } from "../../_data/campaigns";
import { getCampaignPerformancePage, resolveAnalyticsRange } from "../../_data/analytics";
import { getSiteChoices } from "../../_data/sites";
import { AnalyticsComparisonCard } from "../analytics-comparison-card";
import { AnalyticsRangePicker } from "../analytics-range-picker";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default async function CampaignPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    siteId?: string;
    campaignId?: string;
    days?: string;
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

  // Campaigns list is scoped to the selected site so the picker only shows
  // campaigns that actually belong to the current filter context.
  const [stats, comparisonStats, sites, campaignsPayload] = await Promise.all([
    getCampaignPerformancePage(range, query.siteId, query.campaignId),
    comparisonRange ? getCampaignPerformancePage(comparisonRange, query.siteId, query.campaignId) : Promise.resolve(null),
    getSiteChoices(),
    getCampaignList({ siteId: query.siteId }),
  ]);

  const realSites = sites.filter((site) => site.id !== "site-3");
  const selectedCampaign = campaignsPayload.items.find((c) => c.id === query.campaignId);

  // "Sent" in the UI means successfully handed off to the push service --
  // the raw `sent` bucket means acknowledged but not yet delivery-confirmed,
  // so sent+delivered together represents the total dispatched count.
  const dispatchedCount = stats ? stats.sent + stats.delivered : 0;
  const comparisonDispatchedCount = comparisonStats ? comparisonStats.sent + comparisonStats.delivered : 0;

  const scopeLabel = selectedCampaign
    ? selectedCampaign.name
    : query.siteId
      ? (realSites.find((s) => s.id === query.siteId)?.name ?? "Selected site")
      : "All sites";

  return (
    <DashboardShell
      eyebrow="Analytics"
      title="Campaign performance"
      description="Sent, delivered, clicks and CTR across your campaigns — filter by site, campaign, or date range."
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <FilterSelect
              basePath="/analytics/campaigns"
              currentParams={{ days: String(range.days), siteId: query.siteId, campaignId: query.campaignId, preset: query.preset, startDate: query.startDate, endDate: query.endDate, compareMode: query.compareMode }}
              paramKey="siteId"
              allLabel="All sites"
              options={realSites.map((site) => ({ value: site.id, label: site.name }))}
            />
            <FilterSelect
              basePath="/analytics/campaigns"
              currentParams={{ days: String(range.days), siteId: query.siteId, campaignId: query.campaignId, preset: query.preset, startDate: query.startDate, endDate: query.endDate, compareMode: query.compareMode }}
              paramKey="campaignId"
              allLabel="All campaigns"
              options={campaignsPayload.items.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
        </div>
        <AnalyticsRangePicker
          selectedPreset={selectedPreset}
          compareMode={compareMode}
          range={range}
          comparisonRange={comparisonRange}
          siteId={query.siteId ?? ""}
          campaignId={query.campaignId ?? null}
          compact
        />
      </section>

      {comparisonStats && comparisonRange ? (
        <div style={{ marginBottom: 18 }}>
          <AnalyticsComparisonCard
            currentLabel={range.label}
            comparisonLabel={comparisonRange.label}
            metrics={[
              { label: "Sent", current: formatNumber(dispatchedCount), comparison: formatNumber(comparisonDispatchedCount) },
              { label: "Delivered", current: formatNumber(stats?.delivered ?? 0), comparison: formatNumber(comparisonStats.delivered) },
              { label: "Clicks", current: formatNumber(stats?.clicked ?? 0), comparison: formatNumber(comparisonStats.clicked) },
              { label: "CTR", current: formatPercent(stats?.clickThroughRate ?? 0), comparison: formatPercent(comparisonStats.clickThroughRate) },
            ]}
          />
        </div>
      ) : null}

      <section className="card analytics-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Campaign performance</p>
            <h3>{scopeLabel}</h3>
          </div>
        </div>

        {stats && stats.total > 0 ? (
          <div className="analytics-mini-summary">
            <article className="analytics-mini-card">
              <span>Sent</span>
              <strong>{formatNumber(dispatchedCount)}</strong>
            </article>
            <article className="analytics-mini-card">
              <span>Delivered</span>
              <strong>{formatNumber(stats.delivered)}</strong>
            </article>
            <article className="analytics-mini-card">
              <span>Delivery rate</span>
              <strong>{formatPercent(stats.deliveryRate)}</strong>
            </article>
            <article className="analytics-mini-card">
              <span>Clicks</span>
              <strong>{formatNumber(stats.clicked)}</strong>
            </article>
            <article className="analytics-mini-card">
              <span>CTR</span>
              <strong>{formatPercent(stats.clickThroughRate)}</strong>
            </article>
            <article className="analytics-mini-card">
              <span>Failed / expired</span>
              <strong>{formatNumber(stats.failed + stats.expired)}</strong>
            </article>
          </div>
        ) : (
          <p className="subtle" style={{ padding: "20px 0" }}>
            No push deliveries found for this filter in the selected period.
          </p>
        )}
      </section>
    </DashboardShell>
  );
}
