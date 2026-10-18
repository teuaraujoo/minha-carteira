import prisma from "../../../../shared/infrastructure/database/prisma-client.js";
import { StorageContextType as PrismaStorageContextType, StorageStatus as PrismaStorageStatus } from "../../../../../generated/prisma/enums.js";
import { StorageContextType, StorageProvider, StorageStatus } from "../../domain/enums/storage.enums.js";
import type { IStoredFileRepository } from "../../domain/interfaces/storage-repository.interface.js";
import { StoredFile } from "../../domain/entities/stored-file.entity.js";

function mapStoredFile(record: {
  id: string;
  ownerUserId: string;
  contextType: string;
  contextId: string;
  storageProvider: string;
  storageKey: string;
  originalName: string | null;
  mimeType: string;
  sizeInBytes: number;
  checksum: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): StoredFile {
  return new StoredFile({
    ...record,
    contextType: record.contextType as StorageContextType,
    storageProvider: record.storageProvider as StorageProvider,
    status: record.status as StorageStatus,
  });
}

export class PrismaStoredFileRepository implements IStoredFileRepository {
  async findActiveByContext(contextType: StorageContextType, contextId: string): Promise<StoredFile | null> {
    const record = await prisma.storedFile.findFirst({
      where: { contextType: PrismaStorageContextType[contextType], contextId, deletedAt: null, status: PrismaStorageStatus.COMPLETED },
      orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    });
    return record ? mapStoredFile(record) : null;
  }

  async create(file: StoredFile): Promise<StoredFile> {
    const record = await prisma.storedFile.create({
      data: {
        id: file.id,
        ownerUserId: file.ownerUserId,
        contextType: PrismaStorageContextType[file.contextType],
        contextId: file.contextId,
        storageProvider: "CLOUDFLARE_R2",
        storageKey: file.storageKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeInBytes: file.sizeInBytes,
        checksum: file.checksum,
        status: PrismaStorageStatus[file.status],
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        deletedAt: file.deletedAt,
      }
    });
    return mapStoredFile(record);
  }

  async updateStatus(id: string, status: StorageStatus): Promise<StoredFile> {
    const record = await prisma.storedFile.update({ where: { id }, data: { status: PrismaStorageStatus[status] } });
    return mapStoredFile(record);
  }

  async deleteById(id: string): Promise<void> {
    await prisma.storedFile.delete({ where: { id } });
  }

  async markFailed(id: string): Promise<void> {
    await prisma.storedFile.update({ where: { id }, data: { status: PrismaStorageStatus.FAILED } });
  }
}
