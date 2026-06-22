import { IsString, MinLength } from "class-validator";

export class ExchangeBackupCodeDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
