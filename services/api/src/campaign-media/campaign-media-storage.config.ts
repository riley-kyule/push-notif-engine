export interface CampaignMediaStorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export function loadCampaignMediaStorageConfig(): CampaignMediaStorageConfig {
  const bucket = readEnv("CAMPAIGN_MEDIA_STORAGE_BUCKET") ?? "";
  const region = readEnv("CAMPAIGN_MEDIA_STORAGE_REGION") ?? "us-east-1";
  if (!bucket) {
    throw new Error("Missing required environment variable: CAMPAIGN_MEDIA_STORAGE_BUCKET");
  }

  const endpoint = readEnv("CAMPAIGN_MEDIA_STORAGE_ENDPOINT");

  return {
    bucket,
    region,
    ...(endpoint ? { endpoint } : {}),
    ...(readEnv("CAMPAIGN_MEDIA_STORAGE_ACCESS_KEY_ID")
      ? { accessKeyId: readEnv("CAMPAIGN_MEDIA_STORAGE_ACCESS_KEY_ID") as string }
      : {}),
    ...(readEnv("CAMPAIGN_MEDIA_STORAGE_SECRET_ACCESS_KEY")
      ? { secretAccessKey: readEnv("CAMPAIGN_MEDIA_STORAGE_SECRET_ACCESS_KEY") as string }
      : {}),
    forcePathStyle: readEnv("CAMPAIGN_MEDIA_STORAGE_FORCE_PATH_STYLE") !== "false",
  };
}
