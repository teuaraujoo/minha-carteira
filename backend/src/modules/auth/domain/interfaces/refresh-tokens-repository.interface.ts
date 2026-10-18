import type { RefreshToken } from "../entities/auth.entities.js";
import type { RefreshTokenRevokeReason } from "../enums/auth.enums.js";

export interface RefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  findActiveById(id: string, now: Date): Promise<RefreshToken | null>;
  registerUse(id: string, usedAt: Date): Promise<void>;
  revoke(id: string, revokedAt: Date, reason: RefreshTokenRevokeReason): Promise<void>;
  revokeAllFromUser(userId: string, revokedAt: Date, reason: RefreshTokenRevokeReason): Promise<void>;
}
