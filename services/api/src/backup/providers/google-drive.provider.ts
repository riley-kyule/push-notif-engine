import { Injectable } from "@nestjs/common";

import { loadGoogleDriveOAuthConfig } from "../backup.config";
import type { BackupStorageProvider, OAuthTokenResult, RefreshedAccessToken, UploadResult } from "../backup-provider.types";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface GoogleUserInfoResponse {
  email?: string;
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

@Injectable()
export class GoogleDriveBackupProvider implements BackupStorageProvider {
  buildAuthorizeUrl(state: string): string {
    const config = loadGoogleDriveOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      scope: DRIVE_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokenResult> {
    const config = loadGoogleDriveOAuthConfig();
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as GoogleTokenResponse;
    if (!payload.refresh_token) {
      throw new Error(
        "Google did not return a refresh token — this happens if the account already granted consent previously; " +
          "disconnect any prior grant for this app at https://myaccount.google.com/permissions and reconnect.",
      );
    }

    const accountLabel = await this.fetchAccountLabel(payload.access_token);

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresInSeconds: payload.expires_in,
      accountLabel,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshedAccessToken> {
    const config = loadGoogleDriveOAuthConfig();
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as GoogleTokenResponse;
    return { accessToken: payload.access_token, expiresInSeconds: payload.expires_in };
  }

  // Drive's "multipart" upload only supports files up to 5MB — a full system backup
  // (DB dump + media) will routinely be larger than that, so this uses the resumable
  // upload protocol instead: open a session, then PUT the whole body in one shot
  // (resumable doesn't require chunking when the full size is known upfront).
  async upload(accessToken: string, fileName: string, data: Buffer): Promise<UploadResult> {
    const sessionResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/gzip",
        "X-Upload-Content-Length": String(data.length),
      },
      body: JSON.stringify({ name: fileName, mimeType: "application/gzip" }),
    });

    if (!sessionResponse.ok) {
      throw new Error(`Google Drive resumable session failed: ${sessionResponse.status} ${await sessionResponse.text()}`);
    }

    const sessionUri = sessionResponse.headers.get("location");
    if (!sessionUri) {
      throw new Error("Google Drive resumable session did not return a Location header");
    }

    const uploadResponse = await fetch(sessionUri, {
      method: "PUT",
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(data.length),
      },
      body: data,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Google Drive upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
    }

    const payload = (await uploadResponse.json()) as { id?: string };
    return { providerFileId: payload.id ?? null };
  }

  private async fetchAccountLabel(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as GoogleUserInfoResponse;
      return payload.email ?? null;
    } catch {
      return null;
    }
  }
}
