BEGIN;

DROP INDEX IF EXISTS "accounts_user_id_active_name_key";
DROP INDEX IF EXISTS "accounts_user_id_inactivated_at_idx";
DROP INDEX IF EXISTS "accounts_user_id_type_status_idx";
DROP INDEX IF EXISTS "accounts_user_id_status_idx";

DROP TABLE IF EXISTS "accounts";

DROP TYPE IF EXISTS "AccountStatus";
DROP TYPE IF EXISTS "AccountType";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261115161500_create_accounts_table';

COMMIT;
