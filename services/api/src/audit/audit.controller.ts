import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { AuditService } from "./audit.service";
import { ListAuditLogsDto } from "./dto/list-audit-logs.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RateLimit({ limit: 60, ttl: 60_000 })
  async list(@Query() query: ListAuditLogsDto) {
    const page = await this.auditService.list({ limit: query.limit, offset: query.offset });
    return { success: true, data: page };
  }
}
