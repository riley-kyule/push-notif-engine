import { Body, Controller, Post, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateBrowserPushDispatchDto } from "./dto/create-browser-push-dispatch.dto";
import { BrowserPushService } from "./browser-push.service";

@Controller("browser-push")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "editor")
export class BrowserPushController {
  constructor(private readonly browserPushService: BrowserPushService) {}

  @Post("dispatch")
  async dispatch(
    @Body() dto: CreateBrowserPushDispatchDto,
  ): Promise<{ success: true; data: { jobId: string | undefined; queued: true } }> {
    const result = await this.browserPushService.dispatch(dto);
    return { success: true, data: result };
  }
}
