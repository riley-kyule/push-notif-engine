import { Injectable } from "@nestjs/common";

import { loadGoogleSheetsOAuthConfig } from "./google-sheets.config";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
}

interface CreateSpreadsheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

@Injectable()
export class GoogleSheetsClient {
  buildAuthorizeUrl(state: string): string {
    const config = loadGoogleSheetsOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      scope: SHEETS_SCOPE,
      access_type: "online",
      include_granted_scopes: "true",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const config = loadGoogleSheetsOAuthConfig();
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
    return payload.access_token;
  }

  async createSpreadsheet(accessToken: string, title: string, headers: string[], rows: Array<Array<string | number>>): Promise<string> {
    const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { title } }),
    });

    if (!createResponse.ok) {
      throw new Error(`Google Sheets create failed: ${createResponse.status} ${await createResponse.text()}`);
    }

    const created = (await createResponse.json()) as CreateSpreadsheetResponse;

    const values = [headers, ...rows.map((row) => row.map((cell) => (typeof cell === "number" ? cell : String(cell))))];
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values/A1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      },
    );

    if (!writeResponse.ok) {
      throw new Error(`Google Sheets write failed: ${writeResponse.status} ${await writeResponse.text()}`);
    }

    return created.spreadsheetUrl;
  }
}
