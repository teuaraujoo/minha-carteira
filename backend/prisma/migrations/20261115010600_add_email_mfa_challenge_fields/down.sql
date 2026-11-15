BEGIN;

DROP INDEX IF EXISTS "challenges_purpose_target_email_created_at_idx";

ALTER TABLE "challenges" DROP CONSTRAINT IF EXISTS "challenges_subject_target_check";

DELETE FROM "challenges"
WHERE "subject_type"::text = 'EMAIL' OR "subject_id" IS NULL;

ALTER TABLE "challenges"
DROP COLUMN IF EXISTS "next_attempt_at",
DROP COLUMN IF EXISTS "target_email",
ALTER COLUMN "subject_id" SET NOT NULL;

CREATE TYPE "ChallengeSubjectType_old" AS ENUM ('USER', 'MESSAGING_IDENTITY');
ALTER TABLE "challenges" ALTER COLUMN "subject_type" TYPE "ChallengeSubjectType_old" USING ("subject_type"::text::"ChallengeSubjectType_old");
ALTER TYPE "ChallengeSubjectType" RENAME TO "ChallengeSubjectType_new";
ALTER TYPE "ChallengeSubjectType_old" RENAME TO "ChallengeSubjectType";
DROP TYPE "ChallengeSubjectType_new";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261115010600_add_email_mfa_challenge_fields';

COMMIT;
