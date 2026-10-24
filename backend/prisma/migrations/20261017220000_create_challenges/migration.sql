-- CreateEnum
CREATE TYPE "ChallengePurpose" AS ENUM (
    'PASSWORD_RESET',
    'EMAIL_VERIFICATION',
    'MESSAGING_IDENTITY_VERIFICATION',
    'ACCOUNT_REACTIVATION'
);

-- CreateEnum
CREATE TYPE "ChallengeSubjectType" AS ENUM (
    'USER',
    'PASSWORD_RESET_REQUEST',
    'MESSAGING_IDENTITY'
);

CREATE TYPE "ChallengeStatus" AS ENUM (
    'REQUESTED',
    'COMPLETED',
    'FAILED',
    'EXPIRED'
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL,
    "subject_type" "ChallengeSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'REQUESTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "challenges_secret_hash_key" ON "challenges"("secret_hash");
CREATE INDEX "challenges_subject_type_subject_id_idx" ON "challenges"("subject_type", "subject_id");
CREATE INDEX "challenges_status_expires_at_idx" ON "challenges"("status", "expires_at");
