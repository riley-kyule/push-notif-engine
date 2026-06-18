import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import { EstimateSegmentReachDto } from "./dto/estimate-segment-reach.dto";
import { ListSegmentsQueryDto } from "./dto/list-segments-query.dto";
import { UpdateSegmentDto } from "./dto/update-segment.dto";
import { SegmentsService } from "./segments.service";

@Controller("segments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin", "editor")
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Post()
  async createSegment(@Body() dto: CreateSegmentDto): Promise<{ success: true; data: unknown }> {
    const segment = await this.segmentsService.createSegment(dto);
    return { success: true, data: segment };
  }

  @Get()
  async listSegments(@Query() query: ListSegmentsQueryDto): Promise<{ success: true; data: unknown }> {
    const segments = await this.segmentsService.listSegments(query);
    return { success: true, data: segments };
  }

  @Get(":id")
  async getSegment(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const segment = await this.segmentsService.getSegment(id);
    return { success: true, data: segment };
  }

  @Patch(":id")
  async updateSegment(@Param("id") id: string, @Body() dto: UpdateSegmentDto): Promise<{ success: true; data: unknown }> {
    const segment = await this.segmentsService.updateSegment(id, dto);
    return { success: true, data: segment };
  }

  @Delete(":id")
  async deleteSegment(@Param("id") id: string): Promise<{ success: true; data: { deleted: true } }> {
    await this.segmentsService.deleteSegment(id);
    return { success: true, data: { deleted: true } };
  }

  @Post("estimate")
  async estimateReach(@Body() dto: EstimateSegmentReachDto): Promise<{ success: true; data: unknown }> {
    const result = await this.segmentsService.estimateSegmentReach(dto);
    return { success: true, data: result };
  }

  @Get(":id/estimate")
  async estimateSavedSegmentReach(@Param("id") id: string): Promise<{ success: true; data: unknown }> {
    const result = await this.segmentsService.estimateSavedSegmentReach(id);
    return { success: true, data: result };
  }
}
