import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "./env";
import { deploymentSettings } from "./deployment";

const globalDatabase = globalThis as typeof globalThis & {
  pitchmatePrisma?: PrismaClient;
};

export function getPrisma() {
  return (globalDatabase.pitchmatePrisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: getEnv().DATABASE_URL,
      max: deploymentSettings().DB_POOL_MAX,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      query_timeout: 10000,
      ...(process.env.APP_ENV === "production" ||
      process.env.APP_ENV === "staging"
        ? {}
        : { statement_timeout: 5000, options: "-c timezone=UTC" }),
    }),
  }));
}
