const countryDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

// Subscriber country is stored as an ISO 3166-1 alpha-2 code (from the
// browser SDK / cf-ipcountry geo-IP fallback), plus the literal "Unknown"
// when neither is available -- DisplayNames throws on that, so it's passed
// through as-is rather than rendered as a fake country name.
export function formatCountryName(code: string): string {
  if (code === "Unknown") {
    return code;
  }

  try {
    return countryDisplayNames.of(code) ?? code;
  } catch {
    return code;
  }
}
