/**
 * Simple in-memory rate limiter with tier-based configs.
 * Tracks request counts per user within a sliding window.
 * Resets on server restart — acceptable for dev/small-scale.
 * For production, swap to Redis-backed implementation.
 */

import type { UserTier } from "@prisma/client";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxRequests: number;
  /** Window duration in milliseconds. Default: 1 minute */
  windowMs: number;
}

const TIER_CONFIGS: Record<UserTier, RateLimitConfig> = {
  FREE: { maxRequests: 5, windowMs: 60 * 1000 },
  PAID: { maxRequests: 20, windowMs: 60 * 1000 },
  DEV: { maxRequests: Infinity, windowMs: 60 * 1000 },
};

const userLimits = new Map<string, RateLimitEntry>();

/** Get the rate limit config for a user based on tier, with optional per-user override. */
export function getRateLimitConfig(
  tier: UserTier,
  rateLimitOverride?: number | null,
): RateLimitConfig {
  const base = TIER_CONFIGS[tier];
  if (rateLimitOverride != null) {
    return { ...base, maxRequests: rateLimitOverride };
  }
  return base;
}

export function checkRateLimit(
  userId: string,
  config: RateLimitConfig = TIER_CONFIGS.FREE,
): { allowed: boolean; remaining: number; resetInMs: number } {
  // Unlimited users bypass tracking
  if (config.maxRequests === Infinity) {
    return { allowed: true, remaining: Infinity, resetInMs: 0 };
  }

  const now = Date.now();
  const entry = userLimits.get(userId);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    userLimits.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.maxRequests - 1, resetInMs: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    const resetInMs = config.windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetInMs };
  }

  entry.count++;
  const resetInMs = config.windowMs - (now - entry.windowStart);
  return { allowed: true, remaining: config.maxRequests - entry.count, resetInMs };
}
