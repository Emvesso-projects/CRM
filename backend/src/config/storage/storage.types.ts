export interface UploadOptions {
  folder: string;
  organizationId: string;
  filenamePrefix?: string;
  mimeType: string;
  isPublic?: boolean;
}

export interface UploadResult {
  key: string;
  publicUrl: string | null; // null for private assets
  size: number; // bytes
  mimeType: string;
}

export interface StorageObjectInfo {
  key: string;
  size?: number;
  lastModified?: Date;
}

export interface StorageProvider {
  upload(
    buffer: Buffer,
    originalFilename: string,
    options: UploadOptions,
  ): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getPublicUrl(key: string): string | null;
  list?(prefix?: string): Promise<StorageObjectInfo[]>;
}

