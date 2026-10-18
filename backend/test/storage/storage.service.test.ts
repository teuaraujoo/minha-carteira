import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { StorageService } from "../../src/modules/storage/application/services/storage.service.js";
import { StorageContextType, StorageProvider, StorageStatus } from "../../src/modules/storage/domain/enums/storage.enums.js";
import type { IStoredFileRepository } from "../../src/modules/storage/domain/interfaces/storage-repository.interface.js";
import { StoredFile } from "../../src/modules/storage/domain/entities/stored-file.entity.js";
import type { ObjectStorageProvider } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";

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

function setup(options: {
  previous?: StoredFile | null;
  uploadError?: Error;
  statusError?: StorageStatus;
  deleteErrorForKey?: string;
  waitForUpload?: Promise<void>;
  onUploadStarted?: () => void;
} = {}) {
  const calls: string[] = [];
  let saved: StoredFile | null = null;
  let active = options.previous ?? null;
  let failedId: string | null = null;
  const repository: IStoredFileRepository = {
    async findActiveByContext() { calls.push("find"); return active; },
    async create(file) { calls.push("create"); saved = file; return file; },
    async updateStatus(id, status) {
      calls.push(`status:${status}`);
      if (options.statusError === status) throw new Error("Falha simulada ao persistir o status.");
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
      if (status === StorageStatus.COMPLETED) active = next;
      return next;
    },
    async deleteById(id) {
      calls.push("delete-record");
      if (active?.id === id) active = null;
    },
    async markFailed(id) { failedId = id; calls.push("failed"); },
  };
  const objectStorage: ObjectStorageProvider = {
    async upload() {
      calls.push("upload");
      options.onUploadStarted?.();
      await options.waitForUpload;
      if (options.uploadError) throw options.uploadError;
    },
    async delete(key) {
      calls.push("delete-object");
      if (key === options.deleteErrorForKey) throw new Error("Falha simulada ao remover o objeto.");
    },
    async getPresignedUrl(_key, expiry) { calls.push(`url:${expiry}`); return "https://storage.example/file"; },
  };
  const service = new StorageService(repository, objectStorage, () => new Date("2026-10-17T10:00:00.000Z"));
  return {
    service,
    calls,
    get saved() { return saved; },
    get active() { return active; },
    get failedId() { return failedId; },
  };
}

test("storage keeps the previous file until the new file is completed", async () => {
  const state = setup({ previous: existingFile() });
  const result = await state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  });

  assert.deepEqual(state.calls, [
    "find", "create", "status:UPLOADING", "upload", "url:1800",
    "status:COMPLETED", "delete-object", "delete-record",
  ]);
  assert.equal(result.file.status, StorageStatus.COMPLETED);
  assert.equal(state.active?.id, result.file.id);
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

test("storage marks the new attempt as failed and preserves the previous file when R2 rejects the upload", async () => {
  const failure = new Error("Falha simulada no R2.");
  const previous = existingFile();
  const state = setup({ previous, uploadError: failure });

  await assert.rejects(state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  }), (error) => error === failure);

  assert.equal(state.calls.includes("failed"), true);
  assert.equal(state.calls.includes("delete-record"), false);
  assert.equal(state.failedId, state.saved?.id);
  assert.equal(state.active?.id, previous.id);
});

test("storage marks the new attempt as failed and preserves the previous file when completion persistence fails", async () => {
  const previous = existingFile();
  const state = setup({ previous, statusError: StorageStatus.COMPLETED });

  await assert.rejects(state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  }), { message: "Falha simulada ao persistir o status." });

  assert.equal(state.failedId, state.saved?.id);
  assert.equal(state.active?.id, previous.id);
  assert.equal(state.calls.includes("delete-record"), false);
});

test("storage keeps the new image successful when cleanup of the previous object fails", async () => {
  const previous = existingFile();
  const state = setup({ previous, deleteErrorForKey: previous.storageKey });

  const result = await state.service.replaceFileContent({
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  });

  assert.equal(result.file.status, StorageStatus.COMPLETED);
  assert.equal(state.active?.id, result.file.id);
  assert.equal(state.calls.includes("delete-record"), false);
});

test("storage serializes concurrent replacements for the same context within one process", async () => {
  let beginFirstUpload!: () => void;
  let releaseFirstUpload!: () => void;
  const firstUploadStarted = new Promise<void>((resolve) => { beginFirstUpload = resolve; });
  const firstUploadGate = new Promise<void>((resolve) => { releaseFirstUpload = resolve; });
  let uploadCount = 0;
  const state = setup({
    onUploadStarted: () => {
      uploadCount += 1;
      if (uploadCount === 1) beginFirstUpload();
    },
    waitForUpload: firstUploadGate,
  });
  const input = {
    ownerUserId,
    contextType: StorageContextType.USER_PROFILE,
    contextId: ownerUserId,
    mimeType: "image/png",
    content,
  };

  const first = state.service.replaceFileContent(input);
  await firstUploadStarted;
  const second = state.service.replaceFileContent(input);
  await Promise.resolve();
  assert.equal(uploadCount, 1);

  releaseFirstUpload();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(uploadCount, 2);
  assert.notEqual(firstResult.file.id, secondResult.file.id);
  assert.equal(state.active?.id, secondResult.file.id);
  const firstCompletionIndex = state.calls.indexOf("status:COMPLETED");
  const secondFindIndex = state.calls.lastIndexOf("find");
  assert.ok(firstCompletionIndex < secondFindIndex);
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
