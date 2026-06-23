import { IsOptional, IsString, MinLength } from "class-validator";

// Optional — if omitted, the service generates one and returns it once.
export class ResetUserPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
