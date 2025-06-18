import type { User } from "@prisma/client";
import { z } from "zod";

export type SafeUser = Pick<
  User,
  "id" | "firstName" | "lastName" | "createdAt"
>;

const firstName = z.string().min(1).max(50);
const lastName = z.string().min(1).max(50);
const email = z.string().email().max(100);
const id = z.string().min(1);

export const createUserSchema = z.object({
  id,
  firstName,
  lastName,
  email,
});
