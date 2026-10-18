-- CreateEnum
CREATE TYPE "PasswordResetRequestStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED',
    'EXPIRED',
    'CANCELLED'
);

-- CreateTable
CREATE TABLE "password_reset_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "PasswordResetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_requests_user_id_status_idx" ON "password_reset_requests"("user_id", "status");
CREATE INDEX "password_reset_requests_status_expires_at_idx" ON "password_reset_requests"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "password_reset_requests"
ADD CONSTRAINT "password_reset_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
