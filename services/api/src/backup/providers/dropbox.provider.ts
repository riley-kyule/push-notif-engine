import { Injectable } from "@nestjs/common";

import { loadDropboxOAuthConfig } from "../backup.config";
import type { BackupStorageProvider, OAuthTokenResult, RefreshedAccessToken, UploadResult } from "../backup-provider.types";

interface DropboxTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  account_id?: string;
}

@Injectable()
export class DropboxBackupProvider implements BackupStorageProvider {
  buildAuthorizeUrl(state: string): string {
    const config = loadDropboxOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.appKey,
      response_type: "code",
      redirect_uri: config.redirectUri,
      token_access_type: "offline",
      state,
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokenResult> {
    const config = loadDropboxOAuthConfig();
    const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: config.appKey,
        client_secret: config.appSecret,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Dropbox token exchange failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as DropboxTokenResponse;
    if (!payload.refresh_token) {
      throw new Error("Dropbox did not return a refresh token — check token_access_type=offline is set");
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresInSeconds: payload.expires_in,
      accountLabel: payload.account_id ?? null,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshedAccessToken> {
    const config = loadDropboxOAuthConfig();
    const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.appKey,
        client_secret: config.appSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Dropbox token refresh failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as DropboxTokenResponse;
    return { accessToken: payload.access_token, expiresInSeconds: payload.expires_in };
  }

  async upload(accessToken: string, fileName: string, data: Buffer): Promise<UploadResult> {
    // Simple upload API tops out at 150MB. A full system backup (DB dump + media)
    // could exceed that as the subscriber base grows — switching to Dropbox's
    // session/chunked upload API at that point is a known follow-up, not yet needed.
    const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: `/${fileName}`,
          mode: "add",
          autorename: true,
          mute: true,
        }),
      },
      body: data,
    });

    if (!response.ok) {
      throw new Error(`Dropbox upload failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as { id?: string };
    return { providerFileId: payload.id ?? null };
  }
}
