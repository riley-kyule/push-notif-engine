import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import crypto from "node:crypto";

import { AuditService } from "../audit/audit.service";
import { PASSWORD_SERVICE, AUTH_REPOSITORY } from "./auth.constants";
import type { AuthRepository } from "./auth.repository";
import { PasswordService } from "./password.service";
import type { RoleSlug } from "./auth.types";
import type { CreateUserDto } from "./dto/create-user.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import type { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import type { PermissionSlug } from "./auth.types";
import type { AuthUserRecord, RoleRecord } from "./auth.repository";

export interface AccessControlUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  authProvider: "local" | "google";
  googleSubject: string | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
}

// Only returned from createUser/resetPassword — the one moment the plaintext
// exists. Never stored, never returned from listUsers, never logged.
export interface AccessControlUserRecordWithPassword extends AccessControlUserRecord {
  password: string;
}

export interface AccessControlRoleRecord extends RoleRecord {}

// Skips visually similar characters (0/O, 1/l/I) so a password read aloud or
// typed by hand from a screenshot doesn't trip people up.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword(length = 14): string {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += PASSWORD_ALPHABET[bytes[i]! % PASSWORD_ALPHABET.length];
  }
  return password;
}

@Injectable()
export class AccessControlService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers() {
    return this.authRepository.listUsers().then((users) => users.map((user) => this.sanitizeUser(user)));
  }

  async listRoles() {
    return this.authRepository.listRoles();
  }

  async createUser(dto: CreateUserDto, actorUserId?: string): Promise<AccessControlUserRecordWithPassword> {
    const existing = await this.authRepository.findUserByEmail(dto.email);
    if (existing) {
      throw new BadRequestException("User already exists");
    }

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const name = `${firstName} ${lastName}`.trim();
    const username = await this.generateUniqueUsername(firstName);
    const password = dto.password ?? generatePassword();
    const passwordHash = await this.passwordService.hash(password);
    const user = await this.authRepository.createUser({
      firstName,
      lastName,
      username,
      email: dto.email,
      name,
      role: dto.role,
      passwordHash,
      isActive: true,
      authProvider: "local",
      googleSubject: dto.googleSubject ?? null,
      emailVerifiedAt: null,
    });

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "access_control.user_created",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return { ...this.sanitizeUser(user), password };
  }

  async resetUserPassword(userId: string, dto: ResetUserPasswordDto, actorUserId?: string): Promise<AccessControlUserRecordWithPassword> {
    const password = dto.password ?? generatePassword();
    const passwordHash = await this.passwordService.hash(password);
    const user = await this.authRepository.updatePasswordHash(userId, passwordHash);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "access_control.user_password_reset",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
    });

    return { ...this.sanitizeUser(user), password };
  }

  async updateUserRole(userId: string, role: RoleSlug, actorUserId?: string): Promise<AccessControlUserRecord> {
    const user = await this.authRepository.updateUserRole(userId, role);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "access_control.user_role_updated",
      targetType: "user",
      targetId: user.id,
      metadata: { role: user.role },
    });

    return this.sanitizeUser(user);
  }

  async updateRole(slug: RoleSlug, dto: UpdateRoleDto, actorUserId?: string) {
    if (dto.permissions) {
      const invalidPermissions = dto.permissions.filter((permission) => !UpdateRoleDto.allowedPermissions.includes(permission));
      if (invalidPermissions.length > 0) {
        throw new BadRequestException(`Invalid permissions: ${invalidPermissions.join(", ")}`);
      }
    }

    const update: { name?: string; permissions?: PermissionSlug[] } = {};
    if (dto.name !== undefined) {
      update.name = dto.name;
    }
    if (dto.permissions) {
      update.permissions = dto.permissions;
    }

    const role = await this.authRepository.updateRole(slug, update);
    if (!role) {
      throw new NotFoundException("Role not found");
    }

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: "access_control.role_updated",
      targetType: "role",
      targetId: role.id,
      metadata: { slug: role.slug, name: role.name, permissions: role.permissions },
    });

    return role;
  }

  private sanitizeUser(user: AuthUserRecord): AccessControlUserRecord {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      authProvider: user.authProvider,
      googleSubject: user.googleSubject,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async generateUniqueUsername(firstName: string): Promise<string> {
    const base = firstName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .replace(/^(\d+)/, "");
    const fallbackBase = base.length > 0 ? base : "user";

    const existingUsers = await this.authRepository.listUsers();
    const existingUsernames = new Set(existingUsers.map((user) => user.username.toLowerCase()));

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = attempt === 0 ? fallbackBase : `${fallbackBase}${attempt}`;
      if (!existingUsernames.has(candidate.toLowerCase())) {
        return candidate;
      }
    }

    return `${fallbackBase}${Math.floor(Date.now() / 1000)}`;
  }
}
