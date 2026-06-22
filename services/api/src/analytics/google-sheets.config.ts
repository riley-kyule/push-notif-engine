export interface GoogleSheetsOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function readRequiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

// Shares the OAuth client with Google sign-in and the Drive backup connection
// (GOOGLE_OAUTH_CLIENT_ID/SECRET) but needs its own redirect_uri since Google
// requires every redirect_uri to be pre-registered against the client, and this
// flow requests a different scope (Sheets write access) for a one-shot export
// rather than a persistent connection.
export function loadGoogleSheetsOAuthConfig(): GoogleSheetsOAuthConfig {
  return {
    clientId: readRequiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: readRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: readRequiredEnv("GOOGLE_SHEETS_OAUTH_REDIRECT_URI"),
  };
}

export function isGoogleSheetsExportConfigured(): boolean {
  return Boolean(readEnv("GOOGLE_OAUTH_CLIENT_ID") && readEnv("GOOGLE_OAUTH_CLIENT_SECRET") && readEnv("GOOGLE_SHEETS_OAUTH_REDIRECT_URI"));
}
