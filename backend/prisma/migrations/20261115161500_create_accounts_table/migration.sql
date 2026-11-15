BEGIN;

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'CASH', 'DIGITAL', 'SAVINGS', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "accounts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "type" "AccountType" NOT NULL,
  "brand" VARCHAR(60),
  "institution" VARCHAR(80),
  "color" VARCHAR(7),
  "initial_balance" DECIMAL(14, 2) NOT NULL,
  "current_balance" DECIMAL(14, 2) NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "inactivated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounts_initial_balance_non_negative_check" CHECK ("initial_balance" >= 0),
  CONSTRAINT "accounts_status_inactivated_at_check" CHECK (
    ("status" = 'ACTIVE' AND "inactivated_at" IS NULL)
    OR
    ("status" = 'INACTIVE' AND "inactivated_at" IS NOT NULL)
  ),
  CONSTRAINT "accounts_color_hex_check" CHECK (
    "color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$'
  )
);

-- CreateIndex
CREATE INDEX "accounts_user_id_status_idx" ON "accounts"("user_id", "status");
CREATE INDEX "accounts_user_id_type_status_idx" ON "accounts"("user_id", "type", "status");
CREATE INDEX "accounts_user_id_inactivated_at_idx" ON "accounts"("user_id", "inactivated_at");

-- Índice único parcial garantindo unicidade de nome (sem distinguir maiúsculas/minúsculas ou espaços externos) apenas entre contas ativas do mesmo usuário.
CREATE UNIQUE INDEX "accounts_user_id_active_name_key"
  ON "accounts" ("user_id", lower(btrim("name")))
  WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "accounts"
ADD CONSTRAINT "accounts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

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
  'manual_sql_20261115161500_create_accounts_table',
  NOW(),
  '20261115161500_create_accounts_table',
  NULL,
  NULL,
  NOW(),
  1
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = '20261115161500_create_accounts_table'
      AND "rolled_back_at" IS NULL
  );

COMMIT;

-- Rollback manual: consulte down.sql neste mesmo diretório (20261115161500_create_accounts_table/down.sql).
