import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateMobilePushDispatchDto } from "./dto/create-mobile-push-dispatch.dto";
import { InvalidateMobileDeviceDto } from "./dto/invalidate-mobile-device.dto";
import { RegisterMobileDeviceDto } from "./dto/register-mobile-device.dto";
import { RefreshMobileDeviceDto } from "./dto/refresh-mobile-device.dto";
import { UpsertMobileCredentialsDto } from "./dto/upsert-mobile-credentials.dto";
import { MobilePushService } from "./mobile-push.service";

class ListMobileDevicesQueryDto {
  @IsOptional()
  @IsIn(["ios", "android"])
  platform?: "ios" | "android";

  @IsOptional()
  @IsIn(["active", "invalid", "expired"])
  status?: "active" | "invalid" | "expired";

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

class RecordMobilePushClickDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsIn(["ios", "android"])
  platform!: "ios" | "android";

  @IsString()
  @MinLength(8)
  deviceToken!: string;

  @IsUrl({ require_tld: false })
  destinationUrl!: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "sub-admin")
export class MobilePushController {
  constructor(private readonly mobilePushService: MobilePushService) {}

  @Put("sites/:siteId/mobile-credentials")
  async upsertCredentials(
    @Param("siteId") siteId: string,
    @Body() dto: UpsertMobileCredentialsDto,
  ): Promise<{ success: true; data: unknown }> {
    const credentials = await this.mobilePushService.upsertCredentials(siteId, dto);
    return { success: true, data: credentials };
  }

  @Get("sites/:siteId/mobile-credentials")
  async getCredentials(@Param("siteId") siteId: string): Promise<{ success: true; data: unknown }> {
    const credentials = await this.mobilePushService.getCredentials(siteId);
    return { success: true, data: credentials };
  }

  @Get("sites/:siteId/mobile-devices/summary")
  async getDeviceSummary(@Param("siteId") siteId: string): Promise<{ success: true; data: unknown }> {
    const summary = await this.mobilePushService.getDeviceSummary(siteId);
    return { success: true, data: summary };
  }

  @Get("sites/:siteId/mobile-devices")
  async listDevices(
    @Param("siteId") siteId: string,
    @Query() query: ListMobileDevicesQueryDto,
  ): Promise<{ success: true; data: unknown }> {
    const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? "25", 10) || 25));

    const result = await this.mobilePushService.listDevices(siteId, {
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.status ? { status: query.status } : {}),
      limit,
      offset: (page - 1) * limit,
    });

    return { success: true, data: { ...result, page, limit } };
  }

  @Post("mobile-devices/register")
  async registerDevice(@Body() dto: RegisterMobileDeviceDto): Promise<{ success: true; data: unknown }> {
    const device = await this.mobilePushService.registerDevice(dto);
    return { success: true, data: device };
  }

  @Post("mobile-devices/refresh")
  async refreshDevice(@Body() dto: RefreshMobileDeviceDto): Promise<{ success: true; data: unknown }> {
    const device = await this.mobilePushService.refreshDeviceToken(dto);
    return { success: true, data: device };
  }

  @Patch("mobile-devices/invalidate")
  async invalidateDevice(@Body() dto: InvalidateMobileDeviceDto): Promise<{ success: true; data: unknown }> {
    const device = await this.mobilePushService.invalidateDevice(dto);
    return { success: true, data: device };
  }

  @Post("mobile-push/dispatch")
  async dispatch(@Body() dto: CreateMobilePushDispatchDto): Promise<{ success: true; data: unknown }> {
    const result = await this.mobilePushService.dispatch(dto);
    return { success: true, data: result };
  }

  @Post("mobile-push/click")
  async recordClick(@Body() dto: RecordMobilePushClickDto): Promise<{ success: true; data: { recorded: true } }> {
    await this.mobilePushService.recordClick(dto.siteId, dto.platform, dto.deviceToken, dto.destinationUrl);
    return { success: true, data: { recorded: true } };
  }
}
