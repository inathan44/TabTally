import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ApiResponse } from "~/server/contracts/apiResponse";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function withCatch<T, E = Error>(
  fn: () => Promise<T>,
): Promise<ApiResponse<T, E>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error as E,
    };
  }
}
