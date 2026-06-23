import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateContentTaxonomyDto } from "./dto/create-content-taxonomy.dto";
import { UpdateContentTaxonomyDto } from "./dto/update-content-taxonomy.dto";
import { CampaignTaxonomiesService } from "./campaign-taxonomies.service";

@Controller("campaign-taxonomies")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "sub-admin")
export class CampaignTaxonomiesController {
  constructor(private readonly service: CampaignTaxonomiesService) {}

  @Get()
  async list(): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.service.list() };
  }

  @Post()
  async create(@Body() dto: CreateContentTaxonomyDto, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.service.create(dto, user.id) };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateContentTaxonomyDto, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.service.update(id, dto, user.id) };
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: { deleted: true } }> {
    await this.service.delete(id, user.id);
    return { success: true, data: { deleted: true } };
  }
}
