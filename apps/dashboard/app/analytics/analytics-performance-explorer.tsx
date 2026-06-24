"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LineChart } from "../_components/charts/line-chart";
import type { MetricSeries } from "../_components/charts/metric-line-card";

export type ExportSectionOptions = {
  csv: string;
  xlsx: string;
  pdf: string;
  googleSheetsAuthorizeUrl: string;
};

function ExportMenu({ label, options }: { label: string; options: ExportSectionOptions }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetsConfigured, setSheetsConfigured] = useState<boolean | null>(null);
  const [sheetsStatus, setSheetsStatus] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || sheetsConfigured !== null) {
      return;
    }

    void fetch("/api/dashboard/analytics/export/google-sheets/status")
      .then((response) => response.json())
      .then((payload: { data?: { configured?: boolean } }) => setSheetsConfigured(Boolean(payload.data?.configured)))
      .catch(() => setSheetsConfigured(false));
  }, [isOpen, sheetsConfigured]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleGoogleSheetsExport() {
    setIsOpen(false);
    setSheetsStatus("Opening Google sign-in...");
    void fetch(options.googleSheetsAuthorizeUrl)
      .then((response) => response.json())
      .then((payload: { success?: boolean; data?: { authorizeUrl?: string } }) => {
        if (!payload.success || !payload.data?.authorizeUrl) {
          throw new Error("Unable to start the export");
        }
        window.location.href = payload.data.authorizeUrl;
      })
      .catch(() => setSheetsStatus("Unable to start the Google Sheets export. Try again."));
  }

  return (
    <div className="analytics-export-menu" ref={containerRef}>
      <button
        type="button"
        className="analytics-export-button"
        aria-label={`Export ${label} report`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Export"
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3.5v11.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 11.5 12 15.5 16 11.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div className="analytics-export-dropdown" role="menu" aria-label={`Export ${label} report`}>
          <a className="analytics-export-option" role="menuitem" href={options.csv} onClick={() => setIsOpen(false)}>
            Export as CSV
          </a>
          <a className="analytics-export-option" role="menuitem" href={options.xlsx} onClick={() => setIsOpen(false)}>
            Export as Excel
          </a>
          <a className="analytics-export-option" role="menuitem" href={options.pdf} onClick={() => setIsOpen(false)}>
            Export as PDF
          </a>
          <button
            type="button"
            role="menuitem"
            className="analytics-export-option"
            disabled={sheetsConfigured === false}
            onClick={handleGoogleSheetsExport}
          >
            Export to Google Sheets
          </button>
          {sheetsConfigured === false ? <p className="analytics-export-note">Not set up for this server yet.</p> : null}
          {sheetsStatus ? <p className="analytics-export-note">{sheetsStatus}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

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
  initialMetricKey,
  exportOptions,
}: {
  sections: ExplorerSection[];
  controls?: ReactNode;
  initialSectionKey?: string;
  initialMetricKey?: string | undefined;
  exportOptions?: Record<string, ExportSectionOptions>;
}) {
  const [activeSectionKey, setActiveSectionKey] = useState(initialSectionKey && sections.some((section) => section.key === initialSectionKey) ? initialSectionKey : sections[0]?.key ?? "");
  const [activeMetricKeys, setActiveMetricKeys] = useState<Record<string, string>>(
    initialSectionKey && initialMetricKey ? { [initialSectionKey]: initialMetricKey } : {},
  );

  useEffect(() => {
    if (!initialSectionKey) {
      return;
    }
    if (sections.some((section) => section.key === initialSectionKey)) {
      setActiveSectionKey(initialSectionKey);
      if (initialMetricKey) {
        setActiveMetricKeys((current) => ({ ...current, [initialSectionKey]: initialMetricKey }));
      }
    }
  }, [initialSectionKey, initialMetricKey, sections]);

  const activeSection = useMemo(() => sections.find((section) => section.key === activeSectionKey) ?? sections[0], [activeSectionKey, sections]);
  const activeMetricKey = activeMetricKeys[activeSection?.key ?? ""] ?? activeSection?.metrics[0]?.key ?? "";
  const activeMetric = activeSection?.metrics.find((metric) => metric.key === activeMetricKey) ?? activeSection?.metrics[0];

  if (!activeSection) {
    return null;
  }

  const activeExportOptions = exportOptions?.[activeSection.key];

  return (
    <section id="analytics-performance-explorer" className="card analytics-panel analytics-performance-explorer">
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

      <div className="analytics-performance-tabs-row">
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

        {activeExportOptions ? <ExportMenu label={activeSection.label} options={activeExportOptions} /> : null}
      </div>

      <div className="analytics-performance-body">
        {activeSection.selector ? (
          <form className="analytics-site-selector analytics-site-selector--auto" action={activeSection.selector.action} method="get">
            {activeSection.selector.hiddenInputs.map((input) => (
              <input key={input.name} type="hidden" name={input.name} value={input.value} />
            ))}
            <div className="field">
              <label htmlFor="analytics-site">{activeSection.selector.label}</label>
              <select
                id="analytics-site"
                name="siteId"
                className="select"
                defaultValue={activeSection.selector.selectedValue}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
              >
                {activeSection.selector.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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
