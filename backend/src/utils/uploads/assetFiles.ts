import type { Request } from "express";
import { logger } from "../../config/logger";
import { storageService } from "../../config/storage/storage.service";

declare global {
  namespace Express {
    interface Request {
      uploadedStorageKeys?: string[];
    }
  }
}

/**
 * Track an uploaded storage key for automatic rollback/cleanup if the request fails.
 */
export const trackUploadedKey = (req: Request, key: string) => {
  if (!req.uploadedStorageKeys) {
    req.uploadedStorageKeys = [];
  }
  req.uploadedStorageKeys.push(key);
};

/**
 * Discard all storage objects uploaded during a request that did not succeed.
 */
export const removeUploadedFiles = async (req: Request, reason: string) => {
  const keysToClean = new Set(req.uploadedStorageKeys || []);

  if (keysToClean.size > 0) {
    await Promise.all(
      Array.from(keysToClean).map(async (key) => {
        try {
          await storageService.delete(key);
          logger.info("Cleaned up uploaded key on request failure", {
            key,
            reason,
          });
        } catch (err: any) {
          logger.warn("Failed to clean up storage key on request failure", {
            key,
            reason,
            error: err.message,
          });
        }
      }),
    );
  }
};

/**
 * Delete an asset that has been replaced or removed.
 */
export const deleteStoredAsset = async (
  key: string | null | undefined,
  reason: string,
) => {
  if (!key) return;

  try {
    await storageService.delete(key);
    logger.info("Deleted stored asset", { key, reason });
  } catch (err: any) {
    logger.warn("Storage service delete failed during asset replacement", {
      key,
      reason,
      error: err.message,
    });
  }
};
