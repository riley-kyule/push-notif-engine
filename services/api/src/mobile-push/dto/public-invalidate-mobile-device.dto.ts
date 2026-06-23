import { IsIn, IsString, MinLength } from "class-validator";

const MOBILE_PLATFORMS = ["ios", "android"] as const;

export class PublicInvalidateMobileDeviceDto {
  @IsIn(MOBILE_PLATFORMS)
  platform!: (typeof MOBILE_PLATFORMS)[number];

  @IsString()
  @MinLength(8)
  deviceToken!: string;
}
