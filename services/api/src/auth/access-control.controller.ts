import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "./decorators/current-user.decorator";
import { Roles } from "./decorators/roles.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import type { AuthenticatedUser, RoleSlug } from "./auth.types";
import { AccessControlService } from "./access-control.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";

@Controller("access-control")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super-admin", "admin")
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Get("users")
  async listUsers(): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.accessControlService.listUsers() };
  }

  @Post("users")
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.accessControlService.createUser(dto, user.id) };
  }

  @Patch("users/:id/role")
  async updateUserRole(
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.accessControlService.updateUserRole(id, dto.role, user.id) };
  }

  @Patch("users/:id/password")
  async resetUserPassword(
    @Param("id") id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.accessControlService.resetUserPassword(id, dto, user.id) };
  }

  @Get("roles")
  async listRoles(): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.accessControlService.listRoles() };
  }

  @Patch("roles/:slug")
  @Roles("super-admin")
  async updateRole(
    @Param("slug") slug: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: unknown }> {
    return { success: true, data: await this.accessControlService.updateRole(slug as RoleSlug, dto, user.id) };
  }
}
