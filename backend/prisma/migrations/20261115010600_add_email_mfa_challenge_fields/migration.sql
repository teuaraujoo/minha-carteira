BEGIN;

-- CreateEnum
CREATE TYPE "ChallengeSubjectType_new" AS ENUM ('USER', 'MESSAGING_IDENTITY', 'EMAIL');
ALTER TABLE "challenges" ALTER COLUMN "subject_type" TYPE "ChallengeSubjectType_new" USING ("subject_type"::text::"ChallengeSubjectType_new");
ALTER TYPE "ChallengeSubjectType" RENAME TO "ChallengeSubjectType_old";
ALTER TYPE "ChallengeSubjectType_new" RENAME TO "ChallengeSubjectType";
DROP TYPE "ChallengeSubjectType_old";

-- AlterTable
ALTER TABLE "challenges"
ALTER COLUMN "subject_id" DROP NOT NULL,
ADD COLUMN "target_email" TEXT,
ADD COLUMN "next_attempt_at" TIMESTAMP(3);

-- AddConstraint
ALTER TABLE "challenges"
ADD CONSTRAINT "challenges_subject_target_check"
CHECK (
  ("subject_type"::text = 'EMAIL' AND "target_email" IS NOT NULL AND "subject_id" IS NULL)
  OR
  ("subject_type"::text <> 'EMAIL' AND "subject_id" IS NOT NULL AND "target_email" IS NULL)
);

-- CreateIndex
CREATE INDEX "challenges_purpose_target_email_created_at_idx" ON "challenges"("purpose", "target_email", "created_at");

-- RegisterMigration
INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
)
SELECT
  gen_random_uuid()::text,
  'manual_sql_20261115010600_add_email_mfa_challenge_fields',
  NOW(),
  '20261115010600_add_email_mfa_challenge_fields',
  NULL,
  NULL,
  NOW(),
  1
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = '20261115010600_add_email_mfa_challenge_fields'
      AND "rolled_back_at" IS NULL
  );

COMMIT;

-- Rollback manual: consulte down.sql neste mesmo diretório (20261115010600_add_email_mfa_challenge_fields/down.sql).
