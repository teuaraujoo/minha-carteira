BEGIN;

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CONFIRMED', 'PENDING');

-- CreateTable
CREATE TABLE "transactions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "category_id" UUID,
  "description" VARCHAR(120) NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "type" "TransactionType" NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
  "transaction_date" DATE NOT NULL,
  "notes" VARCHAR(500),
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transactions_amount_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "transactions_description_not_blank_check" CHECK (char_length(btrim("description")) >= 2)
);

-- CreateIndex
CREATE INDEX "transactions_user_id_deleted_at_transaction_date_idx" ON "transactions"("user_id", "deleted_at", "transaction_date");
CREATE INDEX "transactions_user_id_account_id_deleted_at_idx" ON "transactions"("user_id", "account_id", "deleted_at");
CREATE INDEX "transactions_user_id_category_id_deleted_at_idx" ON "transactions"("user_id", "category_id", "deleted_at");
CREATE INDEX "transactions_user_id_status_deleted_at_idx" ON "transactions"("user_id", "status", "deleted_at");
CREATE INDEX "transactions_user_id_type_deleted_at_idx" ON "transactions"("user_id", "type", "deleted_at");

-- AddForeignKey
ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

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
  'manual_sql_20261115222700_create_transactions_table',
  NOW(),
  '20261115222700_create_transactions_table',
  NULL,
  NULL,
  NOW(),
  1
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = '20261115222700_create_transactions_table'
      AND "rolled_back_at" IS NULL
  );

COMMIT;

-- Rollback manual: consulte down.sql neste mesmo diretório (20261115222700_create_transactions_table/down.sql).
