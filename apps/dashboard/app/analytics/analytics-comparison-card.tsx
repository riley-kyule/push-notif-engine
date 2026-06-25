export interface ComparisonMetric {
  label: string;
  current: string;
  comparison: string;
}

// Same markup/classes as the range-comparison card on the overview page, so
// every report's comparison view looks identical regardless of which metrics
// it's actually comparing.
export function AnalyticsComparisonCard({
  currentLabel,
  comparisonLabel,
  metrics,
}: {
  currentLabel: string;
  comparisonLabel: string;
  metrics: ComparisonMetric[];
}) {
  return (
    <section className="card analytics-comparison-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Range comparison</p>
          <h3>
            {currentLabel} vs {comparisonLabel}
          </h3>
        </div>
        <span className="badge active">Side by side</span>
      </div>

      <div className="analytics-comparison-grid">
        <article className="analytics-comparison-block">
          <p className="subtle">Selected range</p>
          <strong>{currentLabel}</strong>
          <dl className="analytics-comparison-metrics">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.current}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article className="analytics-comparison-block">
          <p className="subtle">Comparison range</p>
          <strong>{comparisonLabel}</strong>
          <dl className="analytics-comparison-metrics">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.comparison}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}
