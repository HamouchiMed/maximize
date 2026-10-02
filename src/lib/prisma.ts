import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting database connections / re-opening the SQLite file.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 uses driver adapters. better-sqlite3 wants a filesystem path, so
// strip the `file:` scheme from the DATABASE_URL if present.
const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const url = rawUrl.startsWith("file:") ? rawUrl.slice("file:".length) : rawUrl;

const adapter = new PrismaBetterSqlite3({ url });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
