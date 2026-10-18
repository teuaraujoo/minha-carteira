import type { StoredFile } from "../entities/stored-file.entity.js";
import type { StorageContextType, StorageStatus } from "../enums/storage.enums.js";

export interface IStoredFileRepository {
  findActiveByContext(contextType: StorageContextType, contextId: string): Promise<StoredFile | null>;
  create(file: StoredFile): Promise<StoredFile>;
  updateStatus(id: string, status: StorageStatus): Promise<StoredFile>;
  deleteById(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}
