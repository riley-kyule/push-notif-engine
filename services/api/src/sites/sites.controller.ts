import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateSiteDto } from "./dto/create-site.dto";
import { ListSitesQueryDto } from "./dto/list-sites-query.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";
import { SitesService } from "./sites.service";

@Controller("sites")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "editor")
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  async create(@Body() dto: CreateSiteDto): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.createSite(dto);
    return { success: true, data: site };
  }

  @Get()
  async list(@Query() query: ListSitesQueryDto): Promise<{ success: true; data: unknown }> {
    const result = await this.sitesService.listSites(query);
    return { success: true, data: result };
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.getSite(id);
    return { success: true, data: site };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateSiteDto): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.updateSite(id, dto);
    return { success: true, data: site };
  }

  @Post(":id/generate-vapid")
  async generateVapid(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.generateVapidKeys(id);
    return { success: true, data: site };
  }
}
