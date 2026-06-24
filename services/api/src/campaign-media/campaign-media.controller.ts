import { BadRequestException, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors, Body } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { ServerResponse } from "node:http";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { CampaignMediaKind } from "./campaign-media.types";
import type { CampaignMediaUploadFile } from "./campaign-media-file.type";
import { UploadCampaignMediaDto } from "./dto/upload-campaign-media.dto";
import { CampaignMediaService } from "./campaign-media.service";

@Controller("campaign-media")
export class CampaignMediaController {
  constructor(private readonly campaignMediaService: CampaignMediaService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin", "admin", "sub-admin")
  async listMedia(
    @Query("siteId") siteId: string | undefined,
    @Query("kind") kind?: CampaignMediaKind,
  ): Promise<{ success: true; data: unknown }> {
    if (!siteId) {
      throw new BadRequestException("siteId is required");
    }

    const assets = await this.campaignMediaService.listMediaForSite(siteId, kind);
    return { success: true, data: { items: assets } };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super-admin", "admin", "sub-admin")
  @UseInterceptors(FileInterceptor("file"))
  async uploadMedia(
    @Body() dto: UploadCampaignMediaDto,
    @UploadedFile() file: CampaignMediaUploadFile,
  ): Promise<{ success: true; data: unknown }> {
    const asset = await this.campaignMediaService.uploadMedia({
      siteId: dto.siteId,
      kind: dto.kind,
      file,
    });

    return { success: true, data: asset };
  }

  @Get(":id/file")
  async getMediaFile(@Param("id") id: string, @Res() res: ServerResponse): Promise<void> {
    const { asset, stream } = await this.campaignMediaService.openMediaFile(id);
    res.statusCode = 200;
    res.setHeader("content-type", asset.mimeType);
    res.setHeader("cache-control", "public, max-age=86400");
    stream.pipe(res);
  }
}
