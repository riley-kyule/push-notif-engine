"use client";

import { useRouter } from "next/navigation";

const DAYS_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

// Unlike FilterSelect (list-controls.tsx), this always has a real value --
// there's no "All time" state for a days range -- so it doesn't carry the
// nullable-filter "All ___" placeholder option.
export function AnalyticsDaysFilter({
  basePath,
  currentParams,
  days,
}: {
  basePath: string;
  currentParams: Record<string, string | undefined>;
  days: number;
}) {
  const router = useRouter();

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor="analytics-days" className="subtle">
        Range
      </label>
      <select
        id="analytics-days"
        className="select"
        value={String(days)}
        onChange={(event) => {
          const search = new URLSearchParams();
          for (const [key, value] of Object.entries(currentParams)) {
            if (value) search.set(key, value);
          }
          search.set("days", event.target.value);
          router.push(`${basePath}?${search.toString()}`);
        }}
      >
        {DAYS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
