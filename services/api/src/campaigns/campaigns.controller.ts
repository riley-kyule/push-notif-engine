import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CloneCampaignDto } from "./dto/clone-campaign.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { ListCampaignsQueryDto } from "./dto/list-campaigns-query.dto";
import { ScheduleCampaignDto } from "./dto/schedule-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { CampaignsService } from "./campaigns.service";

@Controller("campaigns")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "editor")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async listCampaigns(@Query() query: ListCampaignsQueryDto): Promise<{ success: true; data: unknown }> {
    const campaigns = await this.campaignsService.listCampaigns(query);
    return { success: true, data: campaigns };
  }

  @Post()
  async createCampaign(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    const campaign = await this.campaignsService.createCampaign(dto, user.id);
    return { success: true, data: campaign };
  }

  @Get(":id")
  async getCampaign(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const campaign = await this.campaignsService.getCampaign(id);
    return { success: true, data: campaign };
  }

  @Patch(":id")
  async updateCampaign(
    @Param("id") id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const campaign = await this.campaignsService.updateCampaign(id, dto, user.id);
    return { success: true, data: campaign };
  }

  @Delete(":id")
  async deleteCampaign(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: { deleted: true } }> {
    await this.campaignsService.deleteCampaign(id, user.id);
    return { success: true, data: { deleted: true } };
  }

  @Post(":id/clone")
  async cloneCampaign(
    @Param("id") id: string,
    @Body() dto: CloneCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const campaign = await this.campaignsService.cloneCampaign(id, dto, user.id);
    return { success: true, data: campaign };
  }

  @Post(":id/preview")
  async previewCampaign(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const preview = await this.campaignsService.previewCampaign(id);
    return { success: true, data: preview };
  }

  @Post(":id/schedule")
  async scheduleCampaign(
    @Param("id") id: string,
    @Body() dto: ScheduleCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    const campaign = await this.campaignsService.scheduleCampaign(id, dto, user.id);
    return { success: true, data: campaign };
  }

  @Post(":id/send")
  async sendCampaign(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    const result = await this.campaignsService.sendCampaign(id, user.id);
    return { success: true, data: result };
  }
}
