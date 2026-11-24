import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "./env";

const globalDatabase = globalThis as typeof globalThis & {
  pitchmatePrisma?: PrismaClient;
};

export function getPrisma() {
  return (globalDatabase.pitchmatePrisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      statement_timeout: 5000,
      options: "-c timezone=UTC",
    }),
  }));
}
