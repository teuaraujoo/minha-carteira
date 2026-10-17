import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { StorageService } from "../../src/modules/storage/application/services/storage.service.js";
import { StorageContextType, StorageProvider, StorageStatus } from "../../src/modules/storage/domain/enums/storage.enums.js";
import type { IStoredFileRepository } from "../../src/modules/storage/domain/interfaces/storage-repository.interface.js";
import { StoredFile, type ObjectStorageProvider } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";

const ownerUserId = "123e4567-e89b-42d3-a456-426614174000";
const content = createPngContainer();

function createPngContainer(): Buffer {
  const png = Buffer.alloc(20);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IEND", 12, "ascii");
  return png;
}

function existingFile(): StoredFile {
  const createdAt = new Date("2026-10-17T09:00:00.000Z");
  return new StoredFile({
    id: "previous-file-id",
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    storageProvider: StorageProvider.CLOUDFLARE_R2,
    storageKey: "user_profile/previous-key",
    originalName: null,
    mimeType: "image/png",
    sizeInBytes: content.length,
    checksum: createHash("sha256").update(content).digest("hex"),
    status: StorageStatus.COMPLETED,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  });
}

function setup(options: { previous?: StoredFile | null; uploadError?: Error } = {}) {
  const calls: string[] = [];
  let saved: StoredFile | null = null;
  let failedId: string | null = null;
  const repository: IStoredFileRepository = {
    async findActiveByContext() { calls.push("find"); return options.previous ?? null; },
    async create(file) { calls.push("create"); saved = file; return file; },
    async updateStatus(id, status) {
      calls.push(`status:${status}`);
      if (!saved || saved.id !== id) throw new Error("Arquivo não encontrado.");
      const next = new StoredFile({
        id: saved.id,
        ownerUserId: saved.ownerUserId,
        contextType: saved.contextType,
        contextId: saved.contextId,
        storageProvider: saved.storageProvider,
        storageKey: saved.storageKey,
        originalName: saved.originalName,
        mimeType: saved.mimeType,
        sizeInBytes: saved.sizeInBytes,
        checksum: saved.checksum,
        status,
        createdAt: saved.createdAt,
        updatedAt: new Date("2026-10-17T10:00:00.000Z"),
        deletedAt: saved.deletedAt,
      });
      saved = next;
      return next;
    },
    async deleteById() { calls.push("delete-record"); },
    async markFailed(id) { failedId = id; calls.push("failed"); },
  };
  const objectStorage: ObjectStorageProvider = {
    async upload() { calls.push("upload"); if (options.uploadError) throw options.uploadError; },
    async delete() { calls.push("delete-object"); },
    async getPresignedUrl(_key, expiry) { calls.push(`url:${expiry}`); return "https://storage.example/file"; },
  };
  const service = new StorageService(repository, objectStorage, () => new Date("2026-10-17T10:00:00.000Z"));
  return { service, calls, get saved() { return saved; }, get failedId() { return failedId; } };
}

test("storage replaces the previous file before creating and uploading the new one", async () => {
  const state = setup({ previous: existingFile() });
  const result = await state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  });

  assert.deepEqual(state.calls.slice(0, 4), ["find", "delete-object", "delete-record", "create"]);
  assert.deepEqual(state.calls.slice(4), ["status:UPLOADING", "upload", "url:1800", "status:COMPLETED"]);
  assert.equal(result.file.status, StorageStatus.COMPLETED);
  assert.equal(result.file.checksum, createHash("sha256").update(content).digest("hex"));
  assert.equal(result.expiresAt.toISOString(), "2026-10-17T10:30:00.000Z");
});

test("storage creates the first file when the context has no previous file", async () => {
  const state = setup();
  const result = await state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  });

  assert.equal(state.calls.includes("delete-object"), false);
  assert.equal(result.file.status, StorageStatus.COMPLETED);
});

test("storage marks an uploaded record as failed when R2 rejects the upload", async () => {
  const failure = new Error("Falha simulada no R2.");
  const state = setup({ uploadError: failure });

  await assert.rejects(state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  }), (error) => error === failure);

  assert.equal(state.calls.at(-1), "failed");
  assert.equal(state.failedId, state.saved?.id);
});

test("storage rejects a declared MIME that does not match the bytes before persistence", async () => {
  const state = setup();

  await assert.rejects(state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/jpeg",
    content,
  }), { message: "O conteúdo do arquivo não corresponde ao MIME declarado." });

  assert.deepEqual(state.calls, []);
});
