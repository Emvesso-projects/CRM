import { env } from "../env";
import { logger } from "../logger";
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from "./storage.types";
import { LocalStorageProvider } from "./localStorageProvider";
import { R2StorageProvider } from "./r2StorageProvider";

class StorageService {
  private provider: StorageProvider;
  private providerType: "r2" | "local";

  constructor() {
    this.providerType = env.STORAGE_PROVIDER;

    if (this.providerType === "r2") {
      try {
        this.provider = new R2StorageProvider();
        logger.info("StorageService initialized with Cloudflare R2 provider");
      } catch (err: any) {
        logger.error("Failed to initialize R2StorageProvider, falling back to LocalStorageProvider", {
          error: err.message,
        });
        this.provider = new LocalStorageProvider();
        this.providerType = "local";
      }
    } else {
      this.provider = new LocalStorageProvider();
      logger.info("StorageService initialized with LocalStorageProvider");
    }
  }

  getProviderType(): "r2" | "local" {
    return this.providerType;
  }

  async upload(
    buffer: Buffer,
    originalFilename: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    return this.provider.upload(buffer, originalFilename, options);
  }

  async delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    return this.provider.getSignedUrl(key, expiresInSeconds);
  }

  getPublicUrl(key: string): string | null {
    return this.provider.getPublicUrl(key);
  }

  async list(prefix?: string) {
    if (this.provider.list) {
      return this.provider.list(prefix);
    }
    return [];
  }
}

export const storageService = new StorageService();
export * from "./storage.types";

