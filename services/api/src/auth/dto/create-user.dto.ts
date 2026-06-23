import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

import type { RoleSlug } from "../auth.types";

const USER_ROLE_SLUGS: RoleSlug[] = ["super-admin", "admin", "sub-admin", "customer-service"];

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsIn(USER_ROLE_SLUGS)
  role!: RoleSlug;

  // Optional — if omitted, the service generates one and returns it once.
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  googleSubject?: string | null;
}
