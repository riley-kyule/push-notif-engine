"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { AnalyticsCompareMode, AnalyticsDateRange, AnalyticsPreset } from "../_data/analytics";

type RangeMode = "single" | "range";

interface AnalyticsRangePickerProps {
  selectedPreset: AnalyticsPreset;
  compareMode: AnalyticsCompareMode;
  range: AnalyticsDateRange;
  comparisonRange: AnalyticsDateRange | null;
  siteId: string;
  campaignId: string | null;
  compact?: boolean;
}

const presetOptions: Array<{ key: AnalyticsPreset; label: string; days: number }> = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "1y", label: "1 year", days: 365 },
];

function getDaysFromPreset(preset: AnalyticsPreset): number {
  switch (preset) {
    case "today":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    case "custom":
      return 30;
    default:
      return 30;
  }
}

function buildDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(daySpan, 1);
}

function formatDateLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function buildAnalyticsUrl(pathname: string, params: {
  preset: AnalyticsPreset;
  rangeMode: RangeMode;
  startDate: string;
  endDate: string;
  compareMode: AnalyticsCompareMode;
  compareStartDate: string;
  compareEndDate: string;
  siteId: string;
  campaignId: string | null;
}): string {
  const search = new URLSearchParams();
  search.set("preset", params.preset);
  search.set("days", String(params.preset === "custom" ? buildDaysBetween(params.startDate, params.endDate || params.startDate) : getDaysFromPreset(params.preset)));
  search.set("siteId", params.siteId);

  if (params.campaignId) {
    search.set("campaignId", params.campaignId);
  }

  if (params.preset === "custom") {
    search.set("startDate", params.startDate);
    if (params.rangeMode === "range" && params.endDate) {
      search.set("endDate", params.endDate);
    }
  }

  search.set("compareMode", params.compareMode);
  if (params.compareMode === "custom") {
    if (params.compareStartDate) {
      search.set("compareStartDate", params.compareStartDate);
    }
    if (params.compareEndDate) {
      search.set("compareEndDate", params.compareEndDate);
    }
  }

  return `${pathname}?${search.toString()}`;
}

export function AnalyticsRangePicker({
  selectedPreset,
  compareMode,
  range,
  comparisonRange,
  siteId,
  campaignId,
  compact = false,
}: AnalyticsRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCustomOpen, setIsCustomOpen] = useState(selectedPreset === "custom");
  const [draftPreset, setDraftPreset] = useState<AnalyticsPreset>(selectedPreset);
  const [draftRangeMode, setDraftRangeMode] = useState<RangeMode>(range.days > 1 ? "range" : "single");
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.days > 1 ? range.endDate : "");
  const [draftCompareMode, setDraftCompareMode] = useState<AnalyticsCompareMode>(compareMode);
  const [compareStartDate, setCompareStartDate] = useState(comparisonRange?.startDate ?? "");
  const [compareEndDate, setCompareEndDate] = useState(comparisonRange?.endDate ?? "");

  useEffect(() => {
    setDraftPreset(selectedPreset);
    setDraftRangeMode(range.days > 1 ? "range" : "single");
    setStartDate(range.startDate);
    setEndDate(range.days > 1 ? range.endDate : "");
    setDraftCompareMode(compareMode);
    setCompareStartDate(comparisonRange?.startDate ?? "");
    setCompareEndDate(comparisonRange?.endDate ?? "");
    setIsCustomOpen(selectedPreset === "custom");
  }, [selectedPreset, compareMode, range.days, range.endDate, range.startDate, comparisonRange?.endDate, comparisonRange?.startDate]);

  const summary = useMemo(() => {
    const comparisonLabel =
      draftCompareMode === "previous"
        ? "Previous period"
        : draftCompareMode === "custom"
          ? compareStartDate
            ? compareEndDate
              ? `${formatDateLabel(compareStartDate)} - ${formatDateLabel(compareEndDate)}`
              : formatDateLabel(compareStartDate)
            : "Custom comparison"
          : "No comparison";

    return {
      rangeLabel:
        draftPreset === "custom"
          ? draftRangeMode === "range" && endDate
            ? `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`
            : formatDateLabel(startDate)
          : presetOptions.find((option) => option.key === draftPreset)?.label ?? "Custom",
      comparisonLabel,
    };
  }, [compareEndDate, compareStartDate, draftCompareMode, draftPreset, draftRangeMode, endDate, startDate]);

  function navigate(next: {
    preset: AnalyticsPreset;
    rangeMode: RangeMode;
    startDate: string;
    endDate: string;
    compareMode: AnalyticsCompareMode;
    compareStartDate: string;
    compareEndDate: string;
  }) {
    router.push(
        buildAnalyticsUrl(pathname, {
          ...next,
          siteId,
          campaignId,
        }),
      );
  }

  function handlePresetSelect(preset: AnalyticsPreset) {
    setDraftPreset(preset);
    if (preset === "custom") {
      setIsCustomOpen(true);
      return;
    }

    navigate({
      preset,
      rangeMode: "single",
      startDate: range.startDate,
      endDate: range.endDate,
      compareMode: draftCompareMode,
      compareStartDate,
      compareEndDate,
    });
  }

  function handleApplyCustom() {
    const normalizedEndDate = draftRangeMode === "range" ? endDate || startDate : "";
    navigate({
      preset: "custom",
      rangeMode: draftRangeMode,
      startDate,
      endDate: normalizedEndDate,
      compareMode: draftCompareMode,
      compareStartDate,
      compareEndDate,
    });
  }

  const isCustomComparison = draftCompareMode === "custom";

  const rootClassName = compact ? "analytics-range-picker analytics-range-picker--embedded" : "card analytics-range-picker";
  const headingClassName = compact ? "analytics-range-picker-header analytics-range-picker-header--embedded" : "analytics-range-picker-header";

  return (
    <section className={rootClassName} aria-label="Analytics date controls">
      <div className={headingClassName}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Date controls
          </p>
          <h3>{compact ? "Choose a preset or custom period." : "Preset or custom range."}</h3>
        </div>
        <div className="analytics-range-summary">
          <span className="badge active">Selected: {summary.rangeLabel}</span>
          <span className="badge">{summary.comparisonLabel}</span>
        </div>
      </div>

      <div className="analytics-range-presets" role="tablist" aria-label="Date presets">
        {presetOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`analytics-range-chip ${draftPreset === option.key ? "active" : ""}`}
            onClick={() => handlePresetSelect(option.key)}
            aria-pressed={draftPreset === option.key}
          >
            <span>{option.label}</span>
            <small>{option.key === "today" ? "1 day" : `Last ${option.days === 365 ? "1 year" : option.days + " days"}`}</small>
          </button>
        ))}
        <button
          type="button"
          className={`analytics-range-chip analytics-range-chip--custom ${draftPreset === "custom" ? "active" : ""}`}
          onClick={() => {
            setDraftPreset("custom");
            setIsCustomOpen((open) => !open || draftPreset !== "custom");
          }}
          aria-pressed={draftPreset === "custom"}
        >
          <span>Custom</span>
          <small>Date picker</small>
        </button>
      </div>

      <div className={`analytics-range-panel ${isCustomOpen ? "is-open" : ""}`} aria-hidden={!isCustomOpen}>
        {isCustomOpen ? (
          <>
          <div className="field">
            <label>Selected period</label>
            <div className="analytics-toggle-group" role="radiogroup" aria-label="Selected period mode">
              <button
                type="button"
                className={`analytics-toggle ${draftRangeMode === "single" ? "active" : ""}`}
                onClick={() => {
                  setDraftRangeMode("single");
                }}
                aria-pressed={draftRangeMode === "single"}
              >
                Single date
              </button>
              <button
                type="button"
                className={`analytics-toggle ${draftRangeMode === "range" ? "active" : ""}`}
                onClick={() => setDraftRangeMode("range")}
                aria-pressed={draftRangeMode === "range"}
              >
                Date range
              </button>
            </div>
          </div>

          <div className="analytics-range-grid">
            <div className="field">
              <label htmlFor="analytics-custom-start">Start date</label>
              <input
                id="analytics-custom-start"
                className="input"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            {draftRangeMode === "range" ? (
              <div className="field">
                <label htmlFor="analytics-custom-end">End date</label>
                <input
                  id="analytics-custom-end"
                  className="input"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="field">
            <label>Compare to</label>
            <div className="analytics-toggle-group" role="radiogroup" aria-label="Comparison mode">
              <button
                type="button"
                className={`analytics-toggle ${draftCompareMode === "off" ? "active" : ""}`}
                onClick={() => setDraftCompareMode("off")}
                aria-pressed={draftCompareMode === "off"}
              >
                Off
              </button>
              <button
                type="button"
                className={`analytics-toggle ${draftCompareMode === "previous" ? "active" : ""}`}
                onClick={() => setDraftCompareMode("previous")}
                aria-pressed={draftCompareMode === "previous"}
              >
                Previous period
              </button>
              <button
                type="button"
                className={`analytics-toggle ${draftCompareMode === "custom" ? "active" : ""}`}
                onClick={() => setDraftCompareMode("custom")}
                aria-pressed={draftCompareMode === "custom"}
              >
                Custom period
              </button>
            </div>
          </div>

          {isCustomComparison ? (
            <div className="analytics-range-grid">
              <div className="field">
                <label htmlFor="analytics-compare-start">Compare start</label>
                <input
                  id="analytics-compare-start"
                  className="input"
                  type="date"
                  value={compareStartDate}
                  onChange={(event) => setCompareStartDate(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="analytics-compare-end">Compare end</label>
                <input
                  id="analytics-compare-end"
                  className="input"
                  type="date"
                  value={compareEndDate}
                  onChange={(event) => setCompareEndDate(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="analytics-range-actions">
            <button type="button" className="button secondary" onClick={() => setIsCustomOpen(false)}>
              Close custom
            </button>
            <button type="button" className="button primary" onClick={handleApplyCustom} disabled={!startDate}>
              Apply custom range
            </button>
          </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
