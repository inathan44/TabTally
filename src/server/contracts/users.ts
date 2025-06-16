import type { User } from "@prisma/client";

export type SafeUser = Pick<
  User,
  "id" | "username" | "firstName" | "lastName" | "createdAt"
>;
