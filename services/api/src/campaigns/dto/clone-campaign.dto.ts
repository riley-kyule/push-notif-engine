import { IsOptional, IsString, MinLength } from "class-validator";

export class CloneCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
