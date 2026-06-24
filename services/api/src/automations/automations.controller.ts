import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AutomationsService } from "./automations.service";
import { CreateAutomationDto } from "./dto/create-automation.dto";
import { ListAutomationsQueryDto } from "./dto/list-automations-query.dto";
import { UpdateAutomationDto } from "./dto/update-automation.dto";

@Controller("automations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin")
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post()
  async createAutomation(@Body() dto: CreateAutomationDto, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    const automation = await this.automationsService.createAutomation(dto, user.id);
    return { success: true, data: automation };
  }

  @Post("seed-defaults")
  async seedDefaultAutomations(
    @Body() body: { siteId?: string | null },
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const created = await this.automationsService.seedDefaultAutomations(body.siteId ?? null, user.id);
    return { success: true, data: created };
  }

  @Get()
  async listAutomations(@Query() query: ListAutomationsQueryDto): Promise<{ success: true; data: unknown }> {
    const automations = await this.automationsService.listAutomations(query);
    return { success: true, data: automations };
  }

  @Get(":id")
  async getAutomation(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const automation = await this.automationsService.getAutomation(id);
    return { success: true, data: automation };
  }

  @Patch(":id")
  async updateAutomation(
    @Param("id") id: string,
    @Body() dto: UpdateAutomationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const automation = await this.automationsService.updateAutomation(id, dto, user.id);
    return { success: true, data: automation };
  }

  @Delete(":id")
  async deleteAutomation(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: { deleted: true } }> {
    await this.automationsService.deleteAutomation(id, user.id);
    return { success: true, data: { deleted: true } };
  }
}
