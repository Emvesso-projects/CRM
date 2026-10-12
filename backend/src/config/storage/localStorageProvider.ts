import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { StorageProvider, UploadOptions, UploadResult } from "./storage.types";
import { logger } from "../logger";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), "uploads");
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
    const fullPath = path.resolve(this.baseDir, key);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    logger.info("Uploaded file to local storage", { key, size: buffer.length });

    return {
      key,
      publicUrl: options.isPublic ? `/uploads/${key}` : null,
      size: buffer.length,
      mimeType: options.mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    const cleanKey = key
      .replace(/^https?:\/\/[^\/]+\//, "")
      .replace(/^\/+/, "")
      .replace(/^uploads\//, "");
    const fullPath = path.resolve(this.baseDir, cleanKey);

    if (!fullPath.startsWith(this.baseDir)) {
      logger.warn("LocalStorageProvider refused to delete outside baseDir", {
        key,
      });
      return;
    }

    try {
      await fs.unlink(fullPath);
      logger.info("Deleted file from local storage", { key });
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        logger.error("Failed to delete local file", {
          key,
          error: err.message,
        });
      }
    }
  }

  async getSignedUrl(key: string, _expiresInSeconds = 900): Promise<string> {
    // In local development, return the static uploads endpoint
    const cleanKey = key.replace(/^\/+/, "").replace(/^uploads\//, "");
    return `/uploads/${cleanKey}`;
  }

  getPublicUrl(key: string): string | null {
    const cleanKey = key.replace(/^\/+/, "").replace(/^uploads\//, "");
    return `/uploads/${cleanKey}`;
  }

  async list(prefix?: string): Promise<{ key: string; size?: number; lastModified?: Date }[]> {
    const results: { key: string; size?: number; lastModified?: Date }[] = [];
    const startDir = prefix
      ? path.resolve(this.baseDir, prefix.replace(/^\/+/, "").replace(/^uploads\//, ""))
      : this.baseDir;

    const scan = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scan(full);
          } else if (entry.isFile()) {
            const stats = await fs.stat(full);
            const relKey = path.relative(this.baseDir, full).replace(/\\/g, "/");
            results.push({
              key: relKey,
              size: stats.size,
              lastModified: stats.mtime,
            });
          }
        }
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          throw err;
        }
      }
    };

    await scan(startDir);
    return results;
  }
}