import path from "path";
import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageProvider, UploadOptions, UploadResult, StorageObjectInfo } from "./storage.types";

import { env } from "../env";
import { logger } from "../logger";

export class R2StorageProvider implements StorageProvider {
  private s3Client: S3Client;
  private bucket: string;
  private publicDomain?: string;

  constructor() {
    if (
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET_NAME
    ) {
      throw new Error(
        "R2StorageProvider requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME",
      );
    }

    this.bucket = env.R2_BUCKET_NAME;
    this.publicDomain = env.R2_PUBLIC_CUSTOM_DOMAIN
      ? env.R2_PUBLIC_CUSTOM_DOMAIN.replace(/\/+$/, "")
      : undefined;

    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  private buildKey(originalFilename: string, options: UploadOptions): string {
    const orgPart = options.organizationId
      ? `tenants/${options.organizationId}`
      : "common";
    const cleanFolder = options.folder.replace(/^\/+|\/+$/g, "");
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const prefix = options.filenamePrefix ? `${options.filenamePrefix}-` : "";
    const unique = crypto.randomUUID().slice(0, 8);
    const safeName = this.sanitizeFilename(`${prefix}${baseName}-${unique}${ext}`);
    return `${orgPart}/${cleanFolder}/${safeName}`;
  }

  async upload(
    buffer: Buffer,
    originalFilename: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const key = this.buildKey(originalFilename, options);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: options.mimeType,
      ContentLength: buffer.length,
      CacheControl: options.isPublic
        ? "public, max-age=31536000, immutable"
        : "private, no-cache, no-store",
    });

    await this.s3Client.send(command);

    logger.info("Uploaded file to Cloudflare R2", {
      key,
      size: buffer.length,
      isPublic: !!options.isPublic,
    });

    return {
      key,
      publicUrl: options.isPublic ? this.getPublicUrl(key) : null,
      size: buffer.length,
      mimeType: options.mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    const cleanKey = key
      .replace(/^https?:\/\/[^\/]+\//, "")
      .replace(/^\/+/, "");

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    try {
      await this.s3Client.send(command);
      logger.info("Deleted file from Cloudflare R2", { key: cleanKey });
    } catch (err: any) {
      logger.error("Failed to delete file from Cloudflare R2", {
        key: cleanKey,
        error: err.message,
      });
      throw err;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const cleanKey = key.replace(/^\/+/, "");

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  getPublicUrl(key: string): string | null {
    if (!this.publicDomain) return null;
    const cleanKey = key.replace(/^\/+/, "");
    return `${this.publicDomain}/${cleanKey}`;
  }

  async list(prefix?: string): Promise<StorageObjectInfo[]> {
    const results: StorageObjectInfo[] = [];
    let continuationToken: string | undefined = undefined;

    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix ? prefix.replace(/^\/+/, "") : undefined,
        ContinuationToken: continuationToken,
      });

      const res = await this.s3Client.send(command);
      if (res.Contents) {
        for (const item of res.Contents) {
          if (item.Key) {
            results.push({
              key: item.Key,
              size: item.Size,
              lastModified: item.LastModified,
            });
          }
        }
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return results;
  }
}

