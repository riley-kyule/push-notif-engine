export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  accountLabel: string | null;
}

export interface RefreshedAccessToken {
  accessToken: string;
  expiresInSeconds: number;
}

export interface UploadResult {
  providerFileId: string | null;
}

export interface BackupStorageProvider {
  buildAuthorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokenResult>;
  refreshAccessToken(refreshToken: string): Promise<RefreshedAccessToken>;
  upload(accessToken: string, fileName: string, data: Buffer): Promise<UploadResult>;
}
