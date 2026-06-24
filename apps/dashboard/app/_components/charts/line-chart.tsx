"use client";

import { useMemo, useState } from "react";

export interface LineChartPoint {
  label: string;
  value: number;
}

export function LineChart({
  points,
  color = "var(--primary)",
  formatValue,
  height = 180,
}: {
  points: LineChartPoint[];
  color?: string;
  formatValue?: (value: number) => string;
  height?: number;
}) {
  const width = 720;
  const previewFormatter = formatValue ?? ((value: number) => new Intl.NumberFormat("en-US").format(value));
  const yAxisPreview = useMemo(() => points.map((point) => previewFormatter(point.value)), [points, previewFormatter]);
  const maxLabelLength = yAxisPreview.reduce((length, value) => Math.max(length, value.length), 0);
  const leftPadding = Math.max(64, Math.min(108, maxLabelLength * 8 + 20));
  const padTop = 18;
  const padBottom = 54;
  const padLeft = leftPadding;
  const padRight = 14;
  const innerHeight = height - padTop - padBottom;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="line-chart-empty" style={{ height }}>
        Not enough data yet for this range.
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = points.length > 1 ? (width - padLeft - padRight) / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = padLeft + step * index;
    const y = padTop + innerHeight - ((point.value - min) / range) * innerHeight;
    return { x, y, point };
  });

  const linePath = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`).join(" ");
  const firstCoord = coords[0];
  const lastCoord = coords[coords.length - 1];
  const areaPath =
    firstCoord && lastCoord
      ? `${linePath} L${lastCoord.x.toFixed(2)},${(padTop + innerHeight).toFixed(2)} L${firstCoord.x.toFixed(2)},${(
          padTop + innerHeight
        ).toFixed(2)} Z`
      : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelStride = Math.max(1, Math.ceil(points.length / 8));
  const gradientId = `line-fill-${points.length}-${Math.round(max)}-${Math.round(min)}`;
  const formatAxisValue = (value: number): string => (formatValue ? formatValue(value) : new Intl.NumberFormat("en-US").format(value));
  const activePoint = activeIndex === null ? null : coords[activeIndex] ?? null;
  const activeValue = activePoint ? formatAxisValue(activePoint.point.value) : "Hover a point";

  // The summary box used to just say "Hover data" / "Hover a point" until a
  // user moved their mouse over the chart -- useless at a glance. It now
  // always shows the latest value plus the average and peak, computed from
  // the same points already rendered, so the chart is informative on its
  // own and hover only adds drill-in detail.
  const latestCoord = coords[coords.length - 1] ?? null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peakCoord = coords.reduce<typeof coords[number] | null>(
    (best, coord) => (!best || coord.point.value > best.point.value ? coord : best),
    null,
  );
  const headlinePoint = activePoint ?? latestCoord;
  const headlineLabel = activePoint ? "Selected" : "Latest";

  function setActiveFromClientX(clientX: number, currentTarget: HTMLElement) {
    if (coords.length === 0) {
      return;
    }

    const rect = currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const chartX = padLeft + Math.min(Math.max(ratio, 0), 1) * (width - padLeft - padRight);
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    coords.forEach((coord, index) => {
      const distance = Math.abs(coord.x - chartX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }

  return (
    <div
      className="line-chart-shell"
      tabIndex={0}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setActiveIndex((current) => Math.min((current ?? 0) + 1, coords.length - 1));
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setActiveIndex((current) => Math.max((current ?? coords.length - 1) - 1, 0));
        }
        if (event.key === "Home") {
          event.preventDefault();
          setActiveIndex(0);
        }
        if (event.key === "End") {
          event.preventDefault();
          setActiveIndex(coords.length - 1);
        }
      }}
    >
      <div className="line-chart-summary">
        <div className="line-chart-summary-row">
          <strong>{headlineLabel}</strong>
          <span>{headlinePoint ? `${headlinePoint.point.label} · ${formatAxisValue(headlinePoint.point.value)}` : "No data"}</span>
        </div>
        <span className="line-chart-summary-secondary">
          Avg {formatAxisValue(average)} · Peak {peakCoord ? `${formatAxisValue(peakCoord.point.value)} (${peakCoord.point.label})` : "—"}
        </span>
      </div>

      <div
        className="line-chart-canvas"
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={(event) => setActiveFromClientX(event.clientX, event.currentTarget)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" role="img" aria-label="Line chart">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((fraction) => {
            const y = padTop + innerHeight * fraction;
            const value = max - (max - min) * fraction;
            return (
              <g key={fraction}>
                <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="line-chart-grid" />
                <text x={padLeft - 12} y={y} textAnchor="end" dominantBaseline="middle" className="line-chart-axis-label line-chart-axis-label--y">
                  {formatAxisValue(value)}
                </text>
              </g>
            );
          })}

          {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" /> : null}
          {linePath ? <path d={linePath} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" /> : null}

          {activePoint ? (
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padTop}
              y2={padTop + innerHeight}
              className="line-chart-active-line"
            />
          ) : null}

          {coords.map((coord, index) => {
            const isActive = index === activeIndex;
            return (
              <circle
                key={`${coord.point.label}-${index}`}
                cx={coord.x}
                cy={coord.y}
                r={isActive ? "5.2" : "3.4"}
                fill={color}
                stroke="white"
                strokeWidth={isActive ? "1.8" : "1.4"}
              >
                <title>
                  {coord.point.label}: {formatAxisValue(coord.point.value)}
                </title>
              </circle>
            );
          })}

          {coords.map((coord, index) =>
            index % labelStride === 0 || index === coords.length - 1 ? (
              <text
                key={`label-${index}`}
                x={coord.x}
                y={height - 12}
                textAnchor="middle"
                dominantBaseline="hanging"
                className="line-chart-axis-label"
              >
                {coord.point.label}
              </text>
            ) : null,
          )}
        </svg>

        {activePoint ? (
          <div
            className="line-chart-tooltip"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(Math.max(activePoint.y - 14, 10) / height) * 100}%`,
            }}
          >
            <strong>{activePoint.point.label}</strong>
            <span>{activeValue}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
