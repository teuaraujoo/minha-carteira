-- DropForeignKey
ALTER TABLE "password_reset_requests" DROP CONSTRAINT "password_reset_requests_user_id_fkey";

-- DropTable
DROP TABLE "password_reset_requests";

-- DropEnum
DROP TYPE "PasswordResetRequestStatus";

-- AlterEnum
BEGIN;
CREATE TYPE "ChallengeSubjectType_new" AS ENUM ('USER', 'MESSAGING_IDENTITY');
ALTER TABLE "challenges" ALTER COLUMN "subject_type" TYPE "ChallengeSubjectType_new" USING ("subject_type"::text::"ChallengeSubjectType_new");
ALTER TYPE "ChallengeSubjectType" RENAME TO "ChallengeSubjectType_old";
ALTER TYPE "ChallengeSubjectType_new" RENAME TO "ChallengeSubjectType";
DROP TYPE "ChallengeSubjectType_old";
COMMIT;
