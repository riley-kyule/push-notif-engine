import type { Readable } from "node:stream";

export interface CampaignMediaStorageUploadInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface CampaignMediaStorageCopyInput {
  sourceKey: string;
  destinationKey: string;
  contentType: string;
}

export interface CampaignMediaStoragePort {
  upload(input: CampaignMediaStorageUploadInput): Promise<void>;
  openReadStream(key: string): Promise<Readable | null>;
  copy(input: CampaignMediaStorageCopyInput): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  ping(): Promise<boolean>;
  // Used by the system backup feature to bundle every stored media object into the
  // backup archive — not part of the normal campaign-media request path.
  listAllKeys(): Promise<string[]>;
}
