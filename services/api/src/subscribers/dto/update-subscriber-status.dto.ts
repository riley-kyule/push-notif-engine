import { IsIn, IsOptional } from "class-validator";

const SUBSCRIBER_STATUSES = ["active", "inactive", "unsubscribed", "expired"] as const;

export class UpdateSubscriberStatusDto {
  @IsIn(SUBSCRIBER_STATUSES)
  status!: (typeof SUBSCRIBER_STATUSES)[number];

  @IsOptional()
  lastSeenAt?: string;
}
