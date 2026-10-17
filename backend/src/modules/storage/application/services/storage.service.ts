import { randomUUID } from "node:crypto";
import { StoredFile, type StorageOperations, type StoredFileInput, type StoredFileOutput, type ObjectStorageProvider } from "../../domain/interfaces/storage.interfaces.js";
import { StorageProvider, StorageStatus } from "../../domain/enums/storage.enums.js";
import { StoredFileValidationError, validateStoredFile } from "../../domain/validation/file-validation.js";
import { buildStorageKey } from "../utils/storage.utils.js";
import type { IStoredFileRepository } from "../../domain/interfaces/storage-repository.interface.js";

const PRESIGNED_URL_EXPIRATION_SECONDS = 30 * 60;
const contextLocks = new Map<string, Promise<void>>();

export class StorageService implements StorageOperations {
  constructor(
    private readonly repository: IStoredFileRepository,
    private readonly objectStorage: ObjectStorageProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  upload(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.objectStorage.upload(key, body, contentType);
  }

  delete(key: string): Promise<void> {
    return this.objectStorage.delete(key);
  }

  getPresignedUrl(key: string, expiresInSeconds = 30 * 60): Promise<string> {
    return this.objectStorage.getPresignedUrl(key, expiresInSeconds);
  }

  async replaceFileContent(input: StoredFileInput): Promise<StoredFileOutput> {
    const lockKey = `${input.contextType}:${input.contextId}`;
    const previousLock = contextLocks.get(lockKey) ?? Promise.resolve();
    let release!: () => void;
    const currentLock = new Promise<void>((resolve) => { release = resolve; });
    const queuedLock = previousLock.then(() => currentLock);
    contextLocks.set(lockKey, queuedLock);

    await previousLock;
    try {
      return await this.replaceWithLock(input);
    } finally {
      release();
      if (contextLocks.get(lockKey) === queuedLock) contextLocks.delete(lockKey);
    }
  }

  private async replaceWithLock(input: StoredFileInput): Promise<StoredFileOutput> {
    if (!input.ownerUserId.trim() || !input.contextId.trim()) {
      throw new StoredFileValidationError("O proprietário e o contexto do arquivo são obrigatórios.");
    }
    if (input.originalName && input.originalName.length > 255) {
      throw new StoredFileValidationError("O nome original do arquivo excede 255 caracteres.");
    }
    const validation = validateStoredFile(input.content, input.mimeType);
    const previous = await this.repository.findActiveByContext(input.contextType, input.contextId);
    if (previous) {
      await this.delete(previous.storageKey);
      await this.repository.deleteById(previous.id);
    }

    const id = randomUUID();
    const storageKey = buildStorageKey(input.contextType, input.contextId);
    const processing = new StoredFile({
      id,
      ownerUserId: input.ownerUserId,
      contextType: input.contextType,
      contextId: input.contextId,
      storageProvider: StorageProvider.CLOUDFLARE_R2,
      storageKey,
      originalName: input.originalName ?? null,
      mimeType: input.mimeType,
      sizeInBytes: validation.sizeInBytes,
      checksum: validation.checksum,
      status: StorageStatus.PROCESSING,
      createdAt: this.now(),
      updatedAt: this.now(),
      deletedAt: null,
    });

    await this.repository.create(processing);
    let completed = false;
    try {
      processing.startUpload(this.now());
      await this.repository.updateStatus(id, processing.status);
      await this.upload(storageKey, input.content, input.mimeType);

      const url = await this.getPresignedUrl(storageKey, PRESIGNED_URL_EXPIRATION_SECONDS);
      const expiresAt = new Date(this.now().getTime() + PRESIGNED_URL_EXPIRATION_SECONDS * 1000);
      processing.complete(this.now());
      const file = await this.repository.updateStatus(id, processing.status);
      completed = true;
      return { file, url, expiresAt };
    } catch (error) {
      if (!completed) {
        if (processing.status === StorageStatus.UPLOADING) {
        processing.fail(this.now());
        }
        await this.repository.markFailed(id).catch(() => undefined);
      }
      throw error;
    }
  }
}
