import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "./decorators/current-user.decorator";
import { Roles } from "./decorators/roles.decorator";
import { LoginDto } from "./dto/login.dto";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { AuthService } from "./auth.service";
import type { AuthResponseDto } from "./dto/auth-response.dto";
import type { AuthenticatedUser } from "./auth.types";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import {
  AuthenticationSettingsService,
  type LoginOptions,
} from "./authentication-settings.service";
import { UpdateNativeSignInDto } from "./dto/update-native-sign-in.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authenticationSettingsService: AuthenticationSettingsService,
  ) {}

  @Get("login-options")
  async getLoginOptions(): Promise<{ success: true; data: LoginOptions }> {
    return { success: true, data: await this.authenticationSettingsService.getLoginOptions() };
  }

  @Post("login")
  @RateLimit({ limit: 10, ttl: 60_000 })
  async login(@Body() dto: LoginDto): Promise<{ success: true; data: AuthResponseDto }> {
    const result = await this.authService.login(dto.email, dto.password);
    return { success: true, data: result };
  }

  @Post("google")
  @RateLimit({ limit: 12, ttl: 60_000 })
  async google(@Body() dto: GoogleLoginDto): Promise<{ success: true; data: AuthResponseDto }> {
    const result = await this.authService.loginWithGoogle(dto.idToken);
    return { success: true, data: result };
  }

  @Get("settings/native-sign-in")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin")
  async getNativeSignInSetting(): Promise<{ success: true; data: LoginOptions }> {
    return { success: true, data: await this.authenticationSettingsService.getLoginOptions() };
  }

  @Patch("settings/native-sign-in")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin")
  async updateNativeSignInSetting(
    @Body() dto: UpdateNativeSignInDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: LoginOptions }> {
    return {
      success: true,
      data: await this.authenticationSettingsService.setNativeSignInEnabled(dto.enabled, user.id),
    };
  }

  @Post("refresh")
  @RateLimit({ limit: 30, ttl: 60_000 })
  async refresh(@Body() dto: RefreshTokenDto): Promise<{ success: true; data: AuthResponseDto }> {
    const result = await this.authService.refreshTokens(dto.refreshToken);
    return { success: true, data: result };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: AuthenticatedUser }> {
    const current = await this.authService.getCurrentUser(user.id);
    return { success: true, data: current };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @RateLimit({ limit: 30, ttl: 60_000 })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ success: true; data: { loggedOut: true } }> {
    await this.authService.logout(dto.refreshToken);
    return { success: true, data: { loggedOut: true } };
  }

  @Get("admin-only")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin", "admin")
  async adminOnly(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: { message: string; user: AuthenticatedUser } }> {
    return { success: true, data: { message: "Authorized", user } };
  }
}
