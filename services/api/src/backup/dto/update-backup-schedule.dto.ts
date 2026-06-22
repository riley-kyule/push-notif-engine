import { IsBoolean, IsIn } from "class-validator";

export class UpdateBackupScheduleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsIn(["daily", "weekly", "monthly"])
  frequency!: "daily" | "weekly" | "monthly";
}
