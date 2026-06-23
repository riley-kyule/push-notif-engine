import { Body, Controller, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentSite } from "../sites/decorators/current-site.decorator";
import { RestApiAuthGuard } from "../sites/guards/rest-api-auth.guard";
import type { SiteRecord } from "../sites/sites.types";
import { PublicInvalidateMobileDeviceDto } from "./dto/public-invalidate-mobile-device.dto";
import { PublicRecordMobileClickDto } from "./dto/public-record-mobile-click.dto";
import { PublicRefreshMobileDeviceDto } from "./dto/public-refresh-mobile-device.dto";
import { PublicRegisterMobileDeviceDto } from "./dto/public-register-mobile-device.dto";
import { MobilePushService } from "./mobile-push.service";

// Called directly by the iOS/Android app — not the dashboard. Authenticated with
// the site's REST API key id + token (the same credentials used for CRM/scheduling
// access, generated under Site Settings -> REST API), never a staff JWT. siteId
// always comes from the authenticated site record, never the request body, so a
// valid credential pair for one site can't be used to register devices under
// another site's record.
@Controller("sites/:siteId/mobile-devices")
@UseGuards(RestApiAuthGuard)
export class PublicMobilePushController {
  constructor(private readonly mobilePushService: MobilePushService) {}

  @Post("register")
  async register(
    @CurrentSite() site: SiteRecord,
    @Body() dto: PublicRegisterMobileDeviceDto,
  ): Promise<{ success: true; data: unknown }> {
    const device = await this.mobilePushService.registerDevice({ siteId: site.id, ...dto });
    return { success: true, data: device };
  }

  @Post("refresh")
  async refresh(
    @CurrentSite() site: SiteRecord,
    @Body() dto: PublicRefreshMobileDeviceDto,
  ): Promise<{ success: true; data: unknown }> {
    const device = await this.mobilePushService.refreshDeviceToken({ siteId: site.id, ...dto });
    return { success: true, data: device };
  }

  @Patch("invalidate")
  async invalidate(
    @CurrentSite() site: SiteRecord,
    @Body() dto: PublicInvalidateMobileDeviceDto,
  ): Promise<{ success: true; data: unknown }> {
    const device = await this.mobilePushService.invalidateDevice({ siteId: site.id, ...dto });
    return { success: true, data: device };
  }

  @Post("click")
  async recordClick(
    @CurrentSite() site: SiteRecord,
    @Body() dto: PublicRecordMobileClickDto,
  ): Promise<{ success: true; data: { recorded: true } }> {
    await this.mobilePushService.recordClick(site.id, dto.platform, dto.deviceToken, dto.destinationUrl);
    return { success: true, data: { recorded: true } };
  }
}
