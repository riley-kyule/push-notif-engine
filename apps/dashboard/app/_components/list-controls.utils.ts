// Plain utility, deliberately NOT in list-controls.tsx -- that file is
// "use client" (PageSizeSelect/SearchBox use hooks), and Next.js refuses to
// let server components call a function from a client module directly, even
// a pure one with no hooks. Server pages (sites/page.tsx, subscribers/page.tsx)
// need this for their own server-rendered filter links.
export function buildHref(basePath: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
