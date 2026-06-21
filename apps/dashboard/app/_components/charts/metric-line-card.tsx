"use client";

import { useState, type ReactNode } from "react";

import { LineChart, type LineChartPoint } from "./line-chart";

export type MetricFormat = "number" | "percent";

export interface MetricSeries {
  key: string;
  label: string;
  color: string;
  format?: MetricFormat;
  points: LineChartPoint[];
}

function formatByType(format: MetricFormat | undefined, value: number): string {
  if (format === "percent") {
    return `${value}%`;
  }
  return new Intl.NumberFormat("en-US").format(value);
}

export function MetricLineCard({
  id,
  eyebrow,
  title,
  badge,
  metrics,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  badge?: ReactNode;
  metrics: MetricSeries[];
  children?: ReactNode;
}) {
  const [activeKey, setActiveKey] = useState(metrics[0]?.key);
  const activeMetric = metrics.find((metric) => metric.key === activeKey) ?? metrics[0];

  return (
    <section id={id} className="card analytics-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {badge}
      </div>

      <div className={`metric-card-grid ${children ? "metric-card-grid--split" : ""}`}>
        <div className="metric-card-chart">
          {metrics.length > 1 ? (
            <div className="metric-tabs" role="tablist" aria-label="Statistic">
              {metrics.map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  role="tab"
                  aria-selected={metric.key === activeMetric?.key}
                  className={`metric-tab ${metric.key === activeMetric?.key ? "active" : ""}`}
                  onClick={() => setActiveKey(metric.key)}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          ) : null}

          {activeMetric ? (
            <LineChart points={activeMetric.points} color={activeMetric.color} formatValue={(value) => formatByType(activeMetric.format, value)} />
          ) : null}
        </div>

        {children ? <div className="metric-card-body">{children}</div> : null}
      </div>
    </section>
  );
}
