// Validates a browser request's Origin header against the site domains EPE
// actually knows about, instead of a hand-maintained CORS_ORIGINS env var.
// Every WordPress (or other) site that registers with EPE already has its
// url stored in the sites table, so that's the source of truth -- adding a
// site in the dashboard is then enough on its own; no .env edits or API
// restarts are ever needed for CORS to work for it.
//
// staticOrigins (from CORS_ORIGINS) are still honored as an explicit
// override/allowlist on top of the dynamic check, e.g. for local dev origins
// that don't correspond to any registered site.

export interface SiteUrlSource {
  listSiteUrls(): Promise<string[]>;
}

function extractHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function createOriginAllowlistChecker(
  source: SiteUrlSource,
  staticOrigins: string[],
  cacheTtlMs = 60_000,
): (origin: string) => Promise<boolean> {
  let cachedHostnames = new Set<string>();
  let cacheExpiresAt = 0;

  async function refreshCache(): Promise<void> {
    const urls = await source.listSiteUrls();
    const hostnames = new Set<string>();
    for (const url of urls) {
      const hostname = extractHostname(url);
      if (hostname) {
        hostnames.add(hostname);
      }
    }
    cachedHostnames = hostnames;
    cacheExpiresAt = Date.now() + cacheTtlMs;
  }

  return async function isAllowedOrigin(origin: string): Promise<boolean> {
    if (staticOrigins.includes(origin)) {
      return true;
    }

    const hostname = extractHostname(origin);
    if (!hostname) {
      return false;
    }

    if (Date.now() >= cacheExpiresAt) {
      await refreshCache();
    }

    return cachedHostnames.has(hostname);
  };
}
