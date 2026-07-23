import { Body, Controller, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateBrowserPushDispatchDto } from "./dto/create-browser-push-dispatch.dto";
import { RetryTransientFailuresDto } from "./dto/retry-transient-failures.dto";
import { BrowserPushService } from "./browser-push.service";

@Controller("browser-push")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "sub-admin")
export class BrowserPushController {
  constructor(private readonly browserPushService: BrowserPushService) {}

  @Post("dispatch")
  async dispatch(
    @Body() dto: CreateBrowserPushDispatchDto,
  ): Promise<{ success: true; data: { jobId: string | undefined; queued: true } }> {
    const result = await this.browserPushService.dispatch(dto);
    return { success: true, data: result };
  }

  @Post("clear-failed-deliveries")
  @Roles("super-admin")
  async clearFailedDeliveries(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: { cleared: number } }> {
    const cleared = await this.browserPushService.clearFailedDeliveries(user.id);
    return { success: true, data: { cleared } };
  }

  @Post("retry-transient-failures")
  async retryTransientFailures(
    @Body() body: RetryTransientFailuresDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: { queued: number } }> {
    const result = await this.browserPushService.retryTransientFailures(body, user.id);
    return { success: true, data: result };
  }

  @Post("clear-all-delivery-history")
  @Roles("super-admin")
  async clearAllDeliveryHistory(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: { cleared: number } }> {
    const cleared = await this.browserPushService.clearAllDeliveryHistory(user.id);
    return { success: true, data: { cleared } };
  }
}
