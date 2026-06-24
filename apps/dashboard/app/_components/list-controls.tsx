"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const;

function buildHref(basePath: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export { buildHref };

export function PageSizeSelect({
  basePath,
  currentParams,
  pageSize,
}: {
  basePath: string;
  currentParams: Record<string, string | undefined>;
  pageSize: number;
}) {
  const router = useRouter();

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor="page-size" className="subtle">
        Per page
      </label>
      <select
        id="page-size"
        className="select"
        value={pageSize}
        onChange={(event) => {
          router.push(buildHref(basePath, { ...currentParams, pageSize: event.target.value, page: "1" }));
        }}
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SearchBox({
  basePath,
  currentParams,
  placeholder,
}: {
  basePath: string;
  currentParams: Record<string, string | undefined>;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentParams.search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(currentParams.search ?? "");
  }, [currentParams.search]);

  function handleChange(nextValue: string) {
    setValue(nextValue);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      router.push(buildHref(basePath, { ...currentParams, search: nextValue || undefined, page: "1" }));
    }, 350);
  }

  return (
    <input
      className="input"
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}

export function Pagination({
  basePath,
  currentParams,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  currentParams: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="actions" style={{ justifyContent: "space-between", marginTop: 14 }}>
      <span className="subtle">
        {total === 0 ? "No results" : `Showing ${start}-${end} of ${total}`}
      </span>
      <div className="actions">
        {page <= 1 ? (
          <span className="button secondary is-disabled" aria-disabled="true">
            Previous
          </span>
        ) : (
          <Link className="button secondary" href={buildHref(basePath, { ...currentParams, page: String(page - 1) })}>
            Previous
          </Link>
        )}
        <span className="subtle">
          Page {page} of {totalPages}
        </span>
        {page >= totalPages ? (
          <span className="button secondary is-disabled" aria-disabled="true">
            Next
          </span>
        ) : (
          <Link className="button secondary" href={buildHref(basePath, { ...currentParams, page: String(page + 1) })}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}

export function SortableHeader({
  basePath,
  currentParams,
  field,
  label,
}: {
  basePath: string;
  currentParams: Record<string, string | undefined>;
  field: string;
  label: string;
}) {
  const isActive = currentParams.sortBy === field;
  const nextDir = isActive && currentParams.sortDir === "asc" ? "desc" : "asc";
  const href = buildHref(basePath, { ...currentParams, sortBy: field, sortDir: nextDir, page: "1" });

  return (
    <th aria-sort={isActive ? (currentParams.sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href} className="sortable-header">
        {label}
        {isActive ? <span className="sortable-header-arrow">{currentParams.sortDir === "asc" ? " ▲" : " ▼"}</span> : null}
      </Link>
    </th>
  );
}
