import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";

import { AuditService } from "../audit/audit.service";
import { DATABASE_POOL } from "../database/database.constants";

const NATIVE_SIGN_IN_SETTING_KEY = "auth.native_sign_in_enabled";

export interface LoginOptions {
  nativeSignInEnabled: boolean;
  nativeSignInForced: boolean;
  googleClientId: string | null;
}

@Injectable()
export class AuthenticationSettingsService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  async getLoginOptions(): Promise<LoginOptions> {
    return {
      nativeSignInEnabled: await this.isNativeSignInEnabled(),
      nativeSignInForced: this.nativeSignInForced(),
      googleClientId: this.googleClientId(),
    };
  }

  async isNativeSignInEnabled(): Promise<boolean> {
    if (this.nativeSignInForced()) {
      return true;
    }

    const result = await this.pool.query<{ setting_value: unknown }>(
      "SELECT setting_value FROM system_settings WHERE setting_key = $1",
      [NATIVE_SIGN_IN_SETTING_KEY],
    );
    const value = result.rows[0]?.setting_value;
    return typeof value === "boolean" ? value : true;
  }

  async setNativeSignInEnabled(enabled: boolean, actorUserId: string): Promise<LoginOptions> {
    if (!enabled && this.nativeSignInForced()) {
      throw new BadRequestException(
        "Native sign-in is forced on by EPE_FORCE_NATIVE_SIGN_IN and cannot be deactivated from the dashboard",
      );
    }

    if (!enabled && !this.googleClientId()) {
      throw new BadRequestException(
        "Google Sign-In must be configured before native sign-in can be deactivated",
      );
    }

    await this.pool.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
      [NATIVE_SIGN_IN_SETTING_KEY, JSON.stringify(enabled)],
    );

    await this.auditService.log({
      actorUserId,
      action: enabled ? "auth.native_sign_in_enabled" : "auth.native_sign_in_disabled",
      targetType: "system_setting",
      metadata: { enabled },
    });

    return {
      nativeSignInEnabled: enabled,
      nativeSignInForced: this.nativeSignInForced(),
      googleClientId: this.googleClientId(),
    };
  }

  private googleClientId(): string | null {
    const value = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    return value ? value : null;
  }

  private nativeSignInForced(): boolean {
    return process.env.EPE_FORCE_NATIVE_SIGN_IN?.trim().toLowerCase() === "true";
  }
}
