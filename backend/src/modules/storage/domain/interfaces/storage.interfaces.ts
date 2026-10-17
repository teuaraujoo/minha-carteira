import { StorageContextType, StorageProvider, StorageStatus } from "../enums/storage.enums.js";
import { StoredFileValidationError } from "../validation/file-validation.js";

export interface StoredFileProperties {
  id: string;
  ownerUserId: string;
  contextType: StorageContextType;
  contextId: string;
  storageProvider: StorageProvider;
  storageKey: string;
  originalName: string | null;
  mimeType: string;
  sizeInBytes: number;
  checksum: string;
  status: StorageStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class StoredFile {
  private currentStatus: StorageStatus;
  private currentUpdatedAt: Date;

  readonly id: string;
  readonly ownerUserId: string;
  readonly contextType: StorageContextType;
  readonly contextId: string;
  readonly storageProvider: StorageProvider;
  readonly storageKey: string;
  readonly originalName: string | null;
  readonly mimeType: string;
  readonly sizeInBytes: number;
  readonly checksum: string;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;

  constructor(properties: StoredFileProperties) {
    if (!properties.id.trim() || !properties.ownerUserId.trim() || !properties.contextId.trim()) {
      throw new StoredFileValidationError("Os identificadores do arquivo armazenado são obrigatórios.");
    }
    if (!properties.storageKey.trim() || properties.storageKey.length > 512) {
      throw new StoredFileValidationError("A chave do arquivo deve ter entre 1 e 512 caracteres.");
    }
    if (!properties.mimeType.trim() || properties.mimeType.length > 100) {
      throw new StoredFileValidationError("O tipo MIME deve ter entre 1 e 100 caracteres.");
    }
    if (!Object.values(StorageContextType).includes(properties.contextType)) {
      throw new StoredFileValidationError("O contexto do arquivo armazenado é inválido.");
    }
    if (!Object.values(StorageProvider).includes(properties.storageProvider)) {
      throw new StoredFileValidationError("O provedor do arquivo armazenado é inválido.");
    }
    if (!Object.values(StorageStatus).includes(properties.status)) {
      throw new StoredFileValidationError("O status do arquivo armazenado é inválido.");
    }
    if (properties.originalName && properties.originalName.length > 255) {
      throw new StoredFileValidationError("O nome original do arquivo não pode exceder 255 caracteres.");
    }
    if (!Number.isInteger(properties.sizeInBytes) || properties.sizeInBytes <= 0) {
      throw new StoredFileValidationError("O tamanho do arquivo deve ser um inteiro positivo.");
    }
    if (!/^[a-f0-9]{64}$/i.test(properties.checksum)) {
      throw new StoredFileValidationError("O checksum do arquivo deve ser SHA-256 em hexadecimal.");
    }
    if (!(properties.createdAt instanceof Date) || Number.isNaN(properties.createdAt.getTime())
      || !(properties.updatedAt instanceof Date) || Number.isNaN(properties.updatedAt.getTime())
      || properties.updatedAt < properties.createdAt) {
      throw new StoredFileValidationError("A data de atualização não pode anteceder a criação.");
    }

    this.id = properties.id;
    this.ownerUserId = properties.ownerUserId;
    this.contextType = properties.contextType;
    this.contextId = properties.contextId;
    this.storageProvider = properties.storageProvider;
    this.storageKey = properties.storageKey;
    this.originalName = properties.originalName;
    this.mimeType = properties.mimeType;
    this.sizeInBytes = properties.sizeInBytes;
    this.checksum = properties.checksum;
    this.currentStatus = properties.status;
    this.createdAt = new Date(properties.createdAt);
    this.currentUpdatedAt = new Date(properties.updatedAt);
    this.deletedAt = properties.deletedAt ? new Date(properties.deletedAt) : null;
  }

  get status(): StorageStatus {
    return this.currentStatus;
  }

  get updatedAt(): Date {
    return new Date(this.currentUpdatedAt);
  }

  startUpload(at: Date): void {
    this.transition(StorageStatus.PROCESSING, StorageStatus.UPLOADING, at);
  }

  complete(at: Date): void {
    this.transition(StorageStatus.UPLOADING, StorageStatus.COMPLETED, at);
  }

  fail(at: Date): void {
    this.transition(StorageStatus.UPLOADING, StorageStatus.FAILED, at);
  }

  private transition(from: StorageStatus, to: StorageStatus, at: Date): void {
    if (this.currentStatus !== from) {
      throw new StoredFileValidationError(`Transição de ${this.currentStatus} para ${to} não permitida.`);
    }
    if (!(at instanceof Date) || Number.isNaN(at.getTime()) || at < this.currentUpdatedAt) {
      throw new StoredFileValidationError("A data da transição é inválida.");
    }
    this.currentStatus = to;
    this.currentUpdatedAt = new Date(at);
  }
}

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

export interface ObjectStorageProvider {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export interface StorageOperations {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  replaceFileContent(input: StoredFileInput): Promise<StoredFileOutput>;
}
