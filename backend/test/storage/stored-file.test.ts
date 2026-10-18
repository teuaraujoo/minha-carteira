import assert from "node:assert/strict";
import test from "node:test";
import { StorageProvider, StorageStatus, StorageContextType } from "../../src/modules/storage/domain/enums/storage.enums.js";
import { StoredFile } from "../../src/modules/storage/domain/entities/stored-file.entity.js";

function storedFileProperties(status = StorageStatus.PROCESSING) {
  const createdAt = new Date("2026-10-17T10:00:00.000Z");
  return {
    id: "stored-file-id",
    ownerUserId: "owner-id",
    contextType: StorageContextType.USER_PROFILE,
    contextId: "context-id",
    storageProvider: StorageProvider.CLOUDFLARE_R2,
    storageKey: "user_profile/context-id/opaque-key",
    originalName: "perfil.png",
    mimeType: "image/png",
    sizeInBytes: 12,
    checksum: "a".repeat(64),
    status,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

function createStoredFile(status = StorageStatus.PROCESSING): StoredFile {
  return new StoredFile(storedFileProperties(status));
}

test("StoredFile validates stored metadata", () => {
  assert.throws(() => new StoredFile({ ...storedFileProperties(), checksum: "invalido" }), /SHA-256/);
  assert.throws(() => new StoredFile({ ...storedFileProperties(), sizeInBytes: 0 }), /inteiro positivo/);
  assert.throws(() => new StoredFile({ ...storedFileProperties(), storageKey: "k".repeat(513) }), /512 caracteres/);
  assert.throws(() => new StoredFile({ ...storedFileProperties(), mimeType: "m".repeat(101) }), /100 caracteres/);
  assert.throws(() => new StoredFile({ ...storedFileProperties(), originalName: "n".repeat(256) }), /255 caracteres/);
});

test("StoredFile permits only the approved status transitions", () => {
  const file = createStoredFile();
  const uploadingAt = new Date("2026-10-17T10:01:00.000Z");
  const completedAt = new Date("2026-10-17T10:02:00.000Z");

  file.startUpload(uploadingAt);
  assert.equal(file.status, StorageStatus.UPLOADING);
  file.complete(completedAt);
  assert.equal(file.status, StorageStatus.COMPLETED);
  assert.equal(file.updatedAt.getTime(), completedAt.getTime());
  assert.throws(() => file.fail(new Date("2026-10-17T10:03:00.000Z")), /não permitida/);
});

test("StoredFile can mark a processing attempt as failed", () => {
  const file = createStoredFile();
  file.fail(new Date("2026-10-17T10:01:00.000Z"));

  assert.equal(file.status, StorageStatus.FAILED);
});

test("StoredFile rejects dates that move backwards", () => {
  const file = createStoredFile(StorageStatus.UPLOADING);
  assert.throws(() => file.complete(new Date("2026-10-17T09:59:00.000Z")), /data da transição é inválida/);
});
