import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ListSubscribersQueryDto } from "./dto/list-subscribers-query.dto";
import { RegisterSubscriberDto } from "./dto/register-subscriber.dto";
import { UpdateSubscriberStatusDto } from "./dto/update-subscriber-status.dto";
import { UnsubscribeSubscriberDto } from "./dto/unsubscribe-subscriber.dto";
import { SubscribersService } from "./subscribers.service";
import { resolveCountryFromHeaders } from "./geo-ip.util";

@Controller("subscribers")
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  // Public endpoint — called by the browser SDK, not by authenticated dashboard users.
  // Rate limited by the global Redis-backed rate limit guard (120 req/min per IP).
  @Post("register")
  async register(
    @Body() dto: RegisterSubscriberDto,
    @Req() request: { headers?: Record<string, string | string[] | undefined> },
  ): Promise<{ success: true; data: unknown }> {
    const detectedCountry = resolveCountryFromHeaders(request.headers);
    const subscriber = await this.subscribersService.registerSubscriber(dto, detectedCountry);
    return { success: true, data: subscriber };
  }

  // Public unsubscribe endpoint used by the browser SDK when the user opts out.
  @Post("unsubscribe")
  async unsubscribe(@Body() dto: UnsubscribeSubscriberDto): Promise<{ success: true; data: unknown }> {
    const subscriber = await this.subscribersService.unsubscribeSubscriber(dto);
    return { success: true, data: subscriber };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin", "admin", "editor", "analyst")
  async list(@Query() query: ListSubscribersQueryDto): Promise<{ success: true; data: unknown }> {
    const result = await this.subscribersService.listSubscribers(query);
    return { success: true, data: result };
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin", "admin", "editor", "analyst")
  async get(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const subscriber = await this.subscribersService.getSubscriber(id);
    return { success: true, data: subscriber };
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin", "admin", "editor")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSubscriberStatusDto,
  ): Promise<{ success: true; data: unknown }> {
    const subscriber = await this.subscribersService.updateStatus(id, dto);
    return { success: true, data: subscriber };
  }
}
