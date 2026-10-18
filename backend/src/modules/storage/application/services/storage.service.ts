import { randomUUID } from "node:crypto";
import { StoredFile } from "../../domain/entities/stored-file.entity.js";
import type { StorageOperations, StoredFileInput, StoredFileOutput, ObjectStorageProvider } from "../../domain/interfaces/storage.interfaces.js";
import { StorageProvider, StorageStatus } from "../../domain/enums/storage.enums.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { validateStoredFile } from "../../domain/validation/file-validation.js";
import { buildStorageKey } from "../utils/storage.utils.js";
import type { IStoredFileRepository } from "../../domain/interfaces/storage-repository.interface.js";

const PRESIGNED_URL_EXPIRATION_SECONDS = 30 * 60;
const contextLocks = new Map<string, Promise<void>>();

export class StorageService implements StorageOperations {
  constructor(
    private readonly repository: IStoredFileRepository,
    private readonly objectStorage: ObjectStorageProvider,
    private readonly now: () => Date = () => new Date(),
  ) { }

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
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "O proprietário e o contexto do arquivo são obrigatórios." });
    }
    if (input.originalName && input.originalName.length > 255) {
      throw new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "O nome original do arquivo excede 255 caracteres." });
    }
    const validation = validateStoredFile(input.content, input.mimeType);
    const previous = await this.repository.findActiveByContext(input.contextType, input.contextId);

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

    let completed = false;
    let uploadAttempted = false;
    let file: StoredFile;
    let url: string;
    let expiresAt: Date;
    try {
      await this.repository.create(processing);
      processing.startUpload(this.now());
      await this.repository.updateStatus(id, processing.status);
      uploadAttempted = true;
      await this.upload(storageKey, input.content, input.mimeType);

      url = await this.getPresignedUrl(storageKey, PRESIGNED_URL_EXPIRATION_SECONDS);
      expiresAt = new Date(this.now().getTime() + PRESIGNED_URL_EXPIRATION_SECONDS * 1000);
      processing.complete(this.now());
      file = await this.repository.updateStatus(id, processing.status);
      completed = true;
    } catch (error) {
      if (!completed) {
        if (processing.status === StorageStatus.PROCESSING || processing.status === StorageStatus.UPLOADING) {
          processing.fail(this.now());
        }
        await this.repository.markFailed(id).catch(() => undefined);
        if (uploadAttempted) await this.delete(storageKey).catch(() => undefined);
      }
      throw error;
    }

    if (previous) {
      try {
        await this.delete(previous.storageKey);
        await this.repository.deleteById(previous.id);
      } catch {
        // A nova imagem já está ativa; falhas de limpeza não invalidam o sucesso.
      }
    }

    return { file, url, expiresAt };
  }
}
