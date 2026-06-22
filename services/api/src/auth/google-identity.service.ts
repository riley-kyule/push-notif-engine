import { Injectable, UnauthorizedException } from "@nestjs/common";

interface GoogleTokenInfoResponse {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  iss?: string;
}

export interface GoogleIdentityProfile {
  subject: string;
  email: string;
  emailVerified: boolean;
}

function loadGoogleClientId(): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId || clientId.trim().length === 0) {
    throw new Error("Missing required environment variable: GOOGLE_OAUTH_CLIENT_ID");
  }

  return clientId;
}

@Injectable()
export class GoogleIdentityService {
  async verifyIdToken(idToken: string): Promise<GoogleIdentityProfile> {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      throw new UnauthorizedException("Unable to verify Google sign-in");
    }

    const payload = (await response.json()) as GoogleTokenInfoResponse;
    const clientId = loadGoogleClientId();
    const subject = payload.sub?.trim();
    const email = payload.email?.trim();
    const iss = payload.iss;
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";

    if (!subject || !email) {
      throw new UnauthorizedException("Google sign-in response was incomplete");
    }

    if (payload.aud !== clientId) {
      throw new UnauthorizedException("Google token audience mismatch");
    }

    if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
      throw new UnauthorizedException("Google token issuer mismatch");
    }

    if (!emailVerified) {
      throw new UnauthorizedException("Google email address is not verified");
    }

    return {
      subject,
      email,
      emailVerified,
    };
  }
}
