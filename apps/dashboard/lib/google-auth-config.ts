export function googleClientIdFromEnvironment(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
    ?? process.env.GOOGLE_OAUTH_CLIENT_ID;
}
