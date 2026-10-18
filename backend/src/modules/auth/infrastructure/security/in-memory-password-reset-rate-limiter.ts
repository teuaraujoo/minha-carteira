import type { PasswordResetRateLimiter } from "../../application/contracts/auth.contracts.js";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ACTIVE_KEYS = 10_000;
const EMAIL_LIMIT = 3;
const IP_LIMIT = 10;

export class InMemoryPasswordResetRateLimiter implements PasswordResetRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  private nextPruneAt = 0;

  consume(normalizedEmail: string, ipAddress: string, at: Date): boolean {
    const now = at.getTime();
    this.removeExpired(now);

    const keys = [`email:${normalizedEmail}`, `ip:${ipAddress}`];
    const missingKeys = keys.filter((key) => !this.attempts.has(key));
    if (this.attempts.size + missingKeys.length > MAX_ACTIVE_KEYS) return false;

    const emailAttempts = this.attempts.get(keys[0]!) ?? [];
    const ipAttempts = this.attempts.get(keys[1]!) ?? [];
    const allowed = emailAttempts.length < EMAIL_LIMIT && ipAttempts.length < IP_LIMIT;
    if (!allowed) return false;

    for (const key of keys) {
      const keyAttempts = this.attempts.get(key) ?? [];
      keyAttempts.push(now);
      this.attempts.set(key, keyAttempts);
      this.nextPruneAt = Math.min(this.nextPruneAt, now + WINDOW_MS);
    }
    return true;
  }

  private removeExpired(now: number): void {
    if (now < this.nextPruneAt) return;

    let nextPruneAt = Number.POSITIVE_INFINITY;
    for (const [key, timestamps] of this.attempts) {
      const active = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
      if (active.length === 0) this.attempts.delete(key);
      else {
        this.attempts.set(key, active);
        for (const timestamp of active) nextPruneAt = Math.min(nextPruneAt, timestamp + WINDOW_MS);
      }
    }
    this.nextPruneAt = nextPruneAt;
  }
}
