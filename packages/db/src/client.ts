import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const candidates = [
  path.resolve(process.cwd(), "prisma/dev.db"),
  path.resolve(process.cwd(), "packages/db/prisma/dev.db"),
  path.resolve(process.cwd(), "../../packages/db/prisma/dev.db"),
];
const databaseFile = candidates.find((candidate) => existsSync(candidate));
if (databaseFile) {
  process.env.DATABASE_URL = `file:${databaseFile.replaceAll("\\", "/")}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
