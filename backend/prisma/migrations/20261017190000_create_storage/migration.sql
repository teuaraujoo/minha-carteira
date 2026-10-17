-- CreateEnum
CREATE TYPE "StorageContextType" AS ENUM ('USER_PROFILE', 'GROUP_COVER', 'TRANSACTION_ATTACHMENT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "StorageStatus" AS ENUM ('PROCESSING', 'UPLOADING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('CLOUDFLARE_R2');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "context_type" "StorageContextType" NOT NULL,
    "context_id" UUID NOT NULL,
    "storage_provider" "StorageProvider" NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255),
    "mime_type" VARCHAR(100) NOT NULL,
    "size_in_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "StorageStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_provider_storage_key_key" ON "stored_files"("storage_provider", "storage_key");
CREATE INDEX "stored_files_owner_user_id_status_idx" ON "stored_files"("owner_user_id", "status");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
