import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";

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

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Get("admin-only")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin", "admin")
  async adminOnly(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: { message: string; user: AuthenticatedUser } }> {
    return { success: true, data: { message: "Authorized", user } };
  }
}
