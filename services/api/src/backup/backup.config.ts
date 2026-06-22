export interface DropboxOAuthConfig {
  appKey: string;
  appSecret: string;
  redirectUri: string;
}

export interface GoogleDriveOAuthConfig {
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

export function loadDropboxOAuthConfig(): DropboxOAuthConfig {
  return {
    appKey: readRequiredEnv("DROPBOX_APP_KEY"),
    appSecret: readRequiredEnv("DROPBOX_APP_SECRET"),
    redirectUri: readRequiredEnv("DROPBOX_REDIRECT_URI"),
  };
}

export function loadGoogleDriveOAuthConfig(): GoogleDriveOAuthConfig {
  return {
    clientId: readRequiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: readRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: readRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  };
}

export function isDropboxConfigured(): boolean {
  return Boolean(readEnv("DROPBOX_APP_KEY") && readEnv("DROPBOX_APP_SECRET") && readEnv("DROPBOX_REDIRECT_URI"));
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(readEnv("GOOGLE_OAUTH_CLIENT_ID") && readEnv("GOOGLE_OAUTH_CLIENT_SECRET") && readEnv("GOOGLE_OAUTH_REDIRECT_URI"));
}
