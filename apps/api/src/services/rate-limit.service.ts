/**
 * In-memory sliding-window rate limiter for brute-force and credential stuffing defense.
 */
interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

export class RateLimiterService {
  private static store = new Map<string, RateLimitRecord>();

  /**
   * Check if an action is allowed for a given key (e.g. IP or IP+email).
   * @param key Unique identifier for the client (e.g. `login:${ip}:${email}`)
   * @param maxAttempts Maximum failed attempts allowed in the window
   * @param windowMs Window duration in milliseconds (e.g. 15 minutes)
   * @param blockDurationMs Block duration if exceeded (e.g. 15 minutes)
   */
  static check(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000,
    blockDurationMs: number = 15 * 60 * 1000
  ): { isAllowed: boolean; retryAfterSeconds: number; remainingAttempts: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record) {
      return { isAllowed: true, retryAfterSeconds: 0, remainingAttempts: maxAttempts };
    }

    // Check if actively blocked
    if (record.blockedUntil && record.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return { isAllowed: false, retryAfterSeconds, remainingAttempts: 0 };
    }

    // Check if the window expired
    if (now - record.firstAttemptAt > windowMs) {
      this.store.delete(key);
      return { isAllowed: true, retryAfterSeconds: 0, remainingAttempts: maxAttempts };
    }

    const remaining = Math.max(0, maxAttempts - record.count);
    return {
      isAllowed: record.count < maxAttempts,
      retryAfterSeconds: record.count >= maxAttempts ? Math.ceil(blockDurationMs / 1000) : 0,
      remainingAttempts: remaining,
    };
  }

  /**
   * Record a failed attempt for the given key.
   */
  static recordFailure(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000,
    blockDurationMs: number = 15 * 60 * 1000
  ): { isBlocked: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now - record.firstAttemptAt > windowMs) {
      record = {
        count: 1,
        firstAttemptAt: now,
      };
    } else {
      record.count += 1;
    }

    if (record.count >= maxAttempts) {
      record.blockedUntil = now + blockDurationMs;
      this.store.set(key, record);
      return { isBlocked: true, retryAfterSeconds: Math.ceil(blockDurationMs / 1000) };
    }

    this.store.set(key, record);
    return { isBlocked: false, retryAfterSeconds: 0 };
  }

  /**
   * Reset attempts on successful authentication.
   */
  static reset(key: string): void {
    this.store.delete(key);
  }
}
