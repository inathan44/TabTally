import { PrismaClient } from "@prisma/client";

import { env } from "~/env";

const getDatabaseUrl = (): string => {
  if (env.NODE_ENV === "test") {
    if (!env.TEST_DATABASE_URL) {
      throw new Error(
        "TEST_DATABASE_URL is not set in the environment variables. Please set it to run tests.",
      );
    }
    return env.TEST_DATABASE_URL;
  }

  return env.DATABASE_URL;
};

const createPrismaClient = () =>
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log:
      env.NODE_ENV === "development" || env.NODE_ENV === "test"
        ? ["query", "error", "warn"]
        : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
