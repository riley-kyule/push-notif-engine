import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateSiteDto } from "./dto/create-site.dto";
import { ListSitesQueryDto } from "./dto/list-sites-query.dto";
import { UpdateSiteDto } from "./dto/update-site.dto";
import { SitesService } from "./sites.service";

function redactVapidPrivateKey<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(redactVapidPrivateKey) as T;
  const record = value as Record<string, unknown>;
  const redacted = Object.fromEntries(Object.entries(record).map(([key, item]) => [
    key,
    key === "vapidPrivateKey" ? (item ? "[configured]" : null) : redactVapidPrivateKey(item),
  ]));
  return redacted as T;
}

@Controller("sites")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "sub-admin")
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  async create(@Body() dto: CreateSiteDto, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.createSite(dto, user.id);
    return { success: true, data: redactVapidPrivateKey(site) };
  }

  @Get()
  async list(@Query() query: ListSitesQueryDto): Promise<{ success: true; data: unknown }> {
    const result = await this.sitesService.listSites(query);
    return { success: true, data: redactVapidPrivateKey(result) };
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.getSite(id);
    return { success: true, data: redactVapidPrivateKey(site) };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSiteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.updateSite(id, dto, user.id);
    return { success: true, data: redactVapidPrivateKey(site) };
  }

  @Post(":id/generate-vapid")
  async generateVapid(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    const site = await this.sitesService.generateVapidKeys(id, user.id);
    return { success: true, data: redactVapidPrivateKey(site) };
  }

  @Post(":id/rest-api-credentials")
  async generateRestApiCredentials(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const credentials = await this.sitesService.generateRestApiCredentials(id, user.id);
    return { success: true, data: credentials };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("super-admin")
  async delete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.sitesService.deleteSite(id, user.id);
  }
}
