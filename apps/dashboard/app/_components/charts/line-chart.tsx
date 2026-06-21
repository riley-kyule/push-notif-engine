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
  const padTop = 18;
  const padBottom = 46;
  const padLeft = 52;
  const padRight = 10;
  const innerHeight = height - padTop - padBottom;

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

  return (
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

      {coords.map((coord, index) => (
        <circle key={`${coord.point.label}-${index}`} cx={coord.x} cy={coord.y} r="3.4" fill={color} stroke="white" strokeWidth="1.4">
          <title>
            {coord.point.label}: {formatValue ? formatValue(coord.point.value) : coord.point.value}
          </title>
        </circle>
      ))}

      {coords.map((coord, index) =>
        index % labelStride === 0 || index === coords.length - 1 ? (
          <text
            key={`label-${index}`}
            x={coord.x}
            y={height - 8}
            textAnchor="middle"
            dominantBaseline="hanging"
            className="line-chart-axis-label"
          >
            {coord.point.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
