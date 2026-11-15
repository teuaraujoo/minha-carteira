BEGIN;

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_user_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "categories_user_id_name_key";
DROP INDEX IF EXISTS "categories_default_name_key";
DROP INDEX IF EXISTS "categories_is_default_status_idx";
DROP INDEX IF EXISTS "categories_user_id_status_idx";

-- DropTable
DROP TABLE IF EXISTS "categories";

-- DropEnum
DROP TYPE IF EXISTS "CategoryStatus";

-- UnregisterMigration
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261115222600_create_categories_table';

COMMIT;
