import { IsBoolean } from "class-validator";

export class UpdateNativeSignInDto {
  @IsBoolean()
  enabled!: boolean;
}
