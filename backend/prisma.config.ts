import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/scripts/seed/seed.ts",
  },
  datasource: {
    url: env("STG_DATABASE_URL"),
  },
});
