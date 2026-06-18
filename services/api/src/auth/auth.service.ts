import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import crypto from "node:crypto";

import { AUTH_REPOSITORY, PASSWORD_SERVICE, TOKEN_SERVICE } from "./auth.constants";
import type { AuthRepository } from "./auth.repository";
import type { AuthenticatedUser, LoginResult } from "./auth.types";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: PasswordService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
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

    await this.auditService.log({
      actorUserId: user.id,
      action: "auth.login.success",
      metadata: { email },
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

    if (storedToken.tokenHash !== this.hashToken(refreshToken)) {
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

    return result;
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
