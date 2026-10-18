import type { StoredFile } from "../entities/stored-file.entity.js";
import type { StorageContextType } from "../enums/storage.enums.js";

export interface StoredFileInput {
  ownerUserId: string;
  contextType: StorageContextType;
  contextId: string;
  originalName?: string | null;
  mimeType: string;
  content: Buffer;
}

export interface StoredFileOutput {
  file: StoredFile;
  url: string;
  expiresAt: Date;
}

export interface StoredFileUrlOutput {
  url: string;
  expiresAt: Date;
}

export interface ObjectStorageProvider {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export interface StorageOperations {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getActiveFileUrl(contextType: StorageContextType, contextId: string): Promise<StoredFileUrlOutput | null>;
  replaceFileContent(input: StoredFileInput): Promise<StoredFileOutput>;
}
