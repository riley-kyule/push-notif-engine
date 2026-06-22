function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Cheapest geo-IP signal available without a third-party lookup service: Cloudflare
// and most CDNs/load balancers in front of cPanel-hosted sites set this header with
// the ISO 3166-1 alpha-2 country code already resolved from the client IP.
export function resolveCountryFromHeaders(headers: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const cfCountry = firstHeaderValue(headers?.["cf-ipcountry"]);
  if (cfCountry && cfCountry.length === 2 && cfCountry.toUpperCase() !== "XX") {
    return cfCountry.toUpperCase();
  }

  return undefined;
}
