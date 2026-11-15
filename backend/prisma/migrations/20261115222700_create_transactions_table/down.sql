BEGIN;

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_category_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_account_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_user_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "transactions_user_id_type_deleted_at_idx";
DROP INDEX IF EXISTS "transactions_user_id_status_deleted_at_idx";
DROP INDEX IF EXISTS "transactions_user_id_category_id_deleted_at_idx";
DROP INDEX IF EXISTS "transactions_user_id_account_id_deleted_at_idx";
DROP INDEX IF EXISTS "transactions_user_id_deleted_at_transaction_date_idx";

-- DropTable
DROP TABLE IF EXISTS "transactions";

-- DropEnum
DROP TYPE IF EXISTS "TransactionStatus";
DROP TYPE IF EXISTS "TransactionType";

-- UnregisterMigration
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261115222700_create_transactions_table';

COMMIT;
