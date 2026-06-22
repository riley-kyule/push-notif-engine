import { IsString, IsUrl, MinLength } from "class-validator";

export class UnsubscribeSubscriberDto {
  @IsString()
  @MinLength(1)
  siteId!: string;

  @IsUrl({ require_tld: false })
  subscriptionEndpoint!: string;
}
