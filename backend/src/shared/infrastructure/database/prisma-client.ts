import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../../generated/prisma/client.js";

const databaseUrl = process.env.NODE_ENV === 'production' ? process.env.DATABASE_URL : process.env.STG_DATABASE_URL

if (!databaseUrl) {
  throw new Error("A variável de ambiente DATABASE_URL é obrigatória.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

const prisma = new PrismaClient({ adapter });

export default prisma;
