import { Injectable } from "@nestjs/common";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

import { loadCampaignMediaStorageConfig } from "./campaign-media-storage.config";
import type {
  CampaignMediaStorageCopyInput,
  CampaignMediaStoragePort,
  CampaignMediaStorageUploadInput,
} from "./campaign-media-storage.port";

function encodeS3Key(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

@Injectable()
export class S3CampaignMediaStorageService implements CampaignMediaStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const config = loadCampaignMediaStorageConfig();
    this.bucket = config.bucket;
    const clientConfig = {
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    };
    this.client = new S3Client(clientConfig);
  }

  async upload(input: CampaignMediaStorageUploadInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async openReadStream(key: string): Promise<Readable | null> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const body = response.Body as Readable | undefined;
    return body ?? null;
  }

  async copy(input: CampaignMediaStorageCopyInput): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeS3Key(input.sourceKey)}`,
        Key: input.destinationKey,
        ContentType: input.contentType,
        MetadataDirective: "REPLACE",
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async listAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of response.Contents ?? []) {
        if (object.Key) {
          keys.push(object.Key);
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
