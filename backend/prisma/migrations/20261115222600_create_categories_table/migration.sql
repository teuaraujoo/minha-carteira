BEGIN;

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "categories" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "name" VARCHAR(60) NOT NULL,
  "color" VARCHAR(7),
  "icon" VARCHAR(40),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "categories_name_not_blank_check" CHECK (char_length(btrim("name")) >= 2),
  CONSTRAINT "categories_color_hex_check" CHECK (
    "color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT "categories_default_owner_consistency_check" CHECK (
    ("is_default" = true AND "user_id" IS NULL)
    OR
    ("is_default" = false AND "user_id" IS NOT NULL)
  )
);

-- CreateIndex
CREATE INDEX "categories_user_id_status_idx" ON "categories"("user_id", "status");
CREATE INDEX "categories_is_default_status_idx" ON "categories"("is_default", "status");

-- Índices únicos funcionais para impedir duplicidade de nomes entre categorias padrão e por usuário.
CREATE UNIQUE INDEX "categories_default_name_key"
  ON "categories" (lower(btrim("name")))
  WHERE "is_default" = true;

CREATE UNIQUE INDEX "categories_user_id_name_key"
  ON "categories" ("user_id", lower(btrim("name")))
  WHERE "user_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "categories"
ADD CONSTRAINT "categories_user_id_fkey"
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
  'manual_sql_20261115222600_create_categories_table',
  NOW(),
  '20261115222600_create_categories_table',
  NULL,
  NULL,
  NOW(),
  1
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = '20261115222600_create_categories_table'
      AND "rolled_back_at" IS NULL
  );

COMMIT;

-- Rollback manual: consulte down.sql neste mesmo diretório (20261115222600_create_categories_table/down.sql).
