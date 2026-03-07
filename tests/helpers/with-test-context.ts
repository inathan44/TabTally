import type { PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";

type TransactionalPrismaClient = Omit<PrismaClient, ITXClientDenyList>;

interface TestContext {
  caller: ReturnType<typeof createCaller>;
  tx: TransactionalPrismaClient;
  /** Create an additional caller for a different userId within the same transaction */
  callerAs: (userId: string) => ReturnType<typeof createCaller>;
}

const ROLLBACK_SENTINEL = "VITEST_ROLLBACK";

/**
 * Wraps a test in a Prisma interactive transaction that always rolls back.
 * Provides a tRPC caller wired to the transactional client and a fake userId.
 */
export async function withTestContext(
  fn: (ctx: TestContext) => Promise<void>,
  userId = "test-user-id",
): Promise<void> {
  await db
    .$transaction(
      async (tx) => {
        // Proxy adds a $transaction shim so route handlers that use nested
        // transactions run inline within the outer rollback transaction.
        const txProxy = new Proxy(tx, {
          get(target, prop) {
            if (prop === "$transaction") {
              return async (fnOrArgs: unknown) => {
                if (typeof fnOrArgs === "function") {
                  return await (fnOrArgs as (client: typeof tx) => Promise<unknown>)(tx);
                }
                return await Promise.all(fnOrArgs as Promise<unknown>[]);
              };
            }
            return Reflect.get(target, prop);
          },
        }) as unknown as typeof db;

        const callerAs = (uid: string) =>
          createCaller({
            db: txProxy,
            userId: uid,
            headers: new Headers(),
          });

        const caller = callerAs(userId);

        await fn({ caller, tx, callerAs });

        throw new Error(ROLLBACK_SENTINEL);
      },
      { timeout: 15000 },
    )
    .catch((e: Error) => {
      if (e.message !== ROLLBACK_SENTINEL) throw e;
    });
}
