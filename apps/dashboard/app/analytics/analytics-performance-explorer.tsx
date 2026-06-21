"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { LineChart } from "../_components/charts/line-chart";
import type { MetricSeries } from "../_components/charts/metric-line-card";

type ExplorerRow = {
  primary: string;
  secondary?: string;
  metrics: { label: string; value: string }[];
};

type ExplorerSummary = {
  label: string;
  value: string;
};

type ExplorerSelectorOption = {
  value: string;
  label: string;
  description?: string;
};

type ExplorerSelector = {
  action: string;
  label: string;
  submitLabel: string;
  selectedValue: string;
  options: ExplorerSelectorOption[];
  hiddenInputs: Array<{ name: string; value: string }>;
};

export type ExplorerSection = {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  badge: string;
  metrics: MetricSeries[];
  summary?: ExplorerSummary[];
  selector?: ExplorerSelector;
  rowColumns?: string[];
  rows?: ExplorerRow[];
};

function formatByType(value: number, format: MetricSeries["format"] | undefined): string {
  if (format === "percent") {
    return `${value}%`;
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function AnalyticsPerformanceExplorer({
  sections,
  controls,
  initialSectionKey,
}: {
  sections: ExplorerSection[];
  controls?: ReactNode;
  initialSectionKey?: string;
}) {
  const [activeSectionKey, setActiveSectionKey] = useState(initialSectionKey && sections.some((section) => section.key === initialSectionKey) ? initialSectionKey : sections[0]?.key ?? "");
  const [activeMetricKeys, setActiveMetricKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialSectionKey) {
      return;
    }
    if (sections.some((section) => section.key === initialSectionKey)) {
      setActiveSectionKey(initialSectionKey);
    }
  }, [initialSectionKey, sections]);

  const activeSection = useMemo(() => sections.find((section) => section.key === activeSectionKey) ?? sections[0], [activeSectionKey, sections]);
  const activeMetricKey = activeMetricKeys[activeSection?.key ?? ""] ?? activeSection?.metrics[0]?.key ?? "";
  const activeMetric = activeSection?.metrics.find((metric) => metric.key === activeMetricKey) ?? activeSection?.metrics[0];

  if (!activeSection) {
    return null;
  }

  return (
    <section className="card analytics-panel analytics-performance-explorer">
      <div className="analytics-performance-toolbar">
        <div className="panel-heading analytics-performance-heading">
          <div>
            <p className="eyebrow">{activeSection.eyebrow}</p>
            <h3>{activeSection.title}</h3>
          </div>
          <span className="badge active">{activeSection.badge}</span>
        </div>

        {controls ? <div className="analytics-performance-controls">{controls}</div> : null}
      </div>

      <div className="analytics-performance-tabs" role="tablist" aria-label="Performance type">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            role="tab"
            aria-selected={section.key === activeSection.key}
            className={`analytics-performance-tab ${section.key === activeSection.key ? "active" : ""}`}
            onClick={() => setActiveSectionKey(section.key)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="analytics-performance-body">
        {activeSection.selector ? (
          <form className="analytics-site-selector" action={activeSection.selector.action} method="get">
            {activeSection.selector.hiddenInputs.map((input) => (
              <input key={input.name} type="hidden" name={input.name} value={input.value} />
            ))}
            <div className="field">
              <label htmlFor="analytics-site">{activeSection.selector.label}</label>
              <select id="analytics-site" name="siteId" className="select" defaultValue={activeSection.selector.selectedValue}>
                {activeSection.selector.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="button secondary analytics-mini-button" type="submit">
              {activeSection.selector.submitLabel}
            </button>
          </form>
        ) : null}

        {activeSection.summary ? (
          <div className="analytics-mini-summary">
            {activeSection.summary.map((item) => (
              <article key={item.label} className="analytics-mini-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        ) : null}

        {activeSection.metrics.length > 1 ? (
          <div className="metric-tabs metric-tabs--compact" role="tablist" aria-label="Statistic">
            {activeSection.metrics.map((metric) => (
              <button
                key={metric.key}
                type="button"
                role="tab"
                aria-selected={metric.key === activeMetric?.key}
                className={`metric-tab ${metric.key === activeMetric?.key ? "active" : ""}`}
                onClick={() => setActiveMetricKeys((current) => ({ ...current, [activeSection.key]: metric.key }))}
              >
                {metric.label}
              </button>
            ))}
          </div>
        ) : null}

        {activeMetric ? <LineChart points={activeMetric.points} color={activeMetric.color} formatValue={(value) => formatByType(value, activeMetric.format)} /> : null}

        {activeSection.rows?.length ? (
          <div className="analytics-performance-table analytics-table analytics-table--dense">
            {activeSection.rowColumns ? (
              <div className="analytics-table-head analytics-table-head--compact">
                {activeSection.rowColumns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
            ) : null}
            {activeSection.rows.map((row) => (
              <div key={row.primary} className="analytics-table-row analytics-table-row--compact">
                <div>
                  <strong>{row.primary}</strong>
                  {row.secondary ? <p className="subtle">{row.secondary}</p> : null}
                </div>
                {row.metrics.map((metric) => (
                  <span key={`${row.primary}-${metric.label}`}>
                    <strong>{metric.value}</strong>
                    <p className="subtle">{metric.label}</p>
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
