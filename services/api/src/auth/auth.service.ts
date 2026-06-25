import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import crypto from "node:crypto";

import { AUTH_REPOSITORY, PASSWORD_SERVICE, TOKEN_SERVICE } from "./auth.constants";
import type { AuthRepository } from "./auth.repository";
import type { AuthenticatedUser, LoginResult } from "./auth.types";
import { GoogleIdentityService } from "./google-identity.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { AuditService } from "../audit/audit.service";

// Both inputs are SHA-256 hex digests (64 chars), but length is still
// checked explicitly -- timingSafeEqual throws on a length mismatch rather
// than returning false, and a stored hash should never legitimately differ
// in length from a freshly computed one anyway.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: PasswordService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    private readonly googleIdentityService: GoogleIdentityService,
    private readonly auditService: AuditService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user || !user.isActive) {
      await this.auditService.log({
        action: "auth.login.failure",
        metadata: { reason: "user_not_found_or_inactive", email },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.passwordHash) {
      await this.auditService.log({
        actorUserId: user.id,
        action: "auth.login.failure",
        metadata: { reason: "password_login_disabled", email },
      });
      throw new UnauthorizedException("Password sign-in is disabled for this account");
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, password);
    if (!passwordMatches) {
      await this.auditService.log({
        actorUserId: user.id,
        action: "auth.login.failure",
        metadata: { reason: "invalid_password", email },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const result = await this.issueSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await this.authRepository.recordLastLogin(user.id, new Date());

    await this.auditService.log({
      actorUserId: user.id,
      action: "auth.login.success",
      metadata: { email },
    });

    return result;
  }

  async loginWithGoogle(idToken: string): Promise<LoginResult> {
    const profile = await this.googleIdentityService.verifyIdToken(idToken);
    const existingBySubject = await this.authRepository.findUserByGoogleSubject(profile.subject);
    const existingByEmail = existingBySubject ?? (await this.authRepository.findUserByEmail(profile.email));

    if (!existingByEmail || !existingByEmail.isActive) {
      await this.auditService.log({
        action: "auth.google.login.failure",
        metadata: { reason: "user_not_found_or_inactive", email: profile.email },
      });
      throw new UnauthorizedException("Google account is not linked to an active user");
    }

    if (existingByEmail.googleSubject && existingByEmail.googleSubject !== profile.subject) {
      await this.auditService.log({
        actorUserId: existingByEmail.id,
        action: "auth.google.login.failure",
        metadata: { reason: "subject_mismatch", email: profile.email },
      });
      throw new UnauthorizedException("Google identity mismatch");
    }

    if (!existingBySubject && !existingByEmail.googleSubject) {
      await this.authRepository.linkGoogleIdentity(existingByEmail.id, profile.subject, new Date());
    }

    await this.authRepository.recordLastLogin(existingByEmail.id, new Date());

    const result = await this.issueSession({
      id: existingByEmail.id,
      email: existingByEmail.email,
      name: existingByEmail.name,
      role: existingByEmail.role,
    });

    await this.auditService.log({
      actorUserId: existingByEmail.id,
      action: "auth.google.login.success",
      metadata: { email: profile.email },
    });

    return result;
  }

  async refreshTokens(refreshToken: string): Promise<LoginResult> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);
    if (!payload.jti) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const storedToken = await this.authRepository.findRefreshTokenById(payload.jti);
    if (!storedToken || storedToken.revokedAt) {
      throw new UnauthorizedException("Refresh token revoked");
    }

    if (!timingSafeEqualHex(storedToken.tokenHash, this.hashToken(refreshToken))) {
      throw new UnauthorizedException("Refresh token mismatch");
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User unavailable");
    }

    await this.authRepository.revokeRefreshToken(storedToken.id);

    const result = await this.issueSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await this.auditService.log({
      actorUserId: user.id,
      action: "auth.token.refreshed",
    });

    await this.authRepository.recordLastLogin(user.id, new Date());

    return result;
  }

  // Without this, logging out only cleared the dashboard's cookies -- the
  // refresh token itself stayed valid server-side for its full 30-day
  // lifetime, so a copy of it captured before logout (XSS, a synced device,
  // a shared machine) could still mint fresh access tokens indefinitely.
  async logout(refreshToken: string): Promise<void> {
    let jti: string | undefined;
    try {
      jti = this.tokenService.verifyRefreshToken(refreshToken).jti;
    } catch {
      // An already-invalid/expired token has nothing to revoke -- logout
      // should still succeed from the caller's point of view either way.
      return;
    }

    if (!jti) {
      return;
    }

    const storedToken = await this.authRepository.findRefreshTokenById(jti);
    if (storedToken && !storedToken.revokedAt) {
      await this.authRepository.revokeRefreshToken(storedToken.id);
    }
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new BadRequestException("Unknown user");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
  }

  private async issueSession(user: AuthenticatedUser): Promise<LoginResult> {
    const tokens = this.tokenService.createTokenPair(user);
    const refreshPayload = this.tokenService.verifyRefreshToken(tokens.refreshToken);

    await this.authRepository.storeRefreshToken({
      id: refreshPayload.jti ?? crypto.randomUUID(),
      userId: user.id,
      tokenHash: this.hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { user, tokens };
  }
}
