import type { RefreshToken } from "../../domain/entities/auth.entities.js";
import type { RefreshTokenRevokeReason } from "../../domain/enums/auth.enums.js";

export interface TokenSubject {
  userId: string;
  sessionId: string;
}

export interface VerifiedToken extends TokenSubject {
  tokenId: string;
  type: "access" | "refresh";
  issuedAt: Date;
  expiresAt: Date;
}

export interface JwtProvider {
  signAccessToken(subject: TokenSubject): Promise<string>;
  signRefreshToken(subject: TokenSubject): Promise<string>;
  verifyAccessToken(token: string): Promise<VerifiedToken>;
  verifyRefreshToken(token: string): Promise<VerifiedToken>;
}

export interface TokenHasher {
  hash(token: string): Promise<string>;
  matches(token: string, expectedHash: string): Promise<boolean>;
}

export interface RefreshTokenRepository {
  save(refreshToken: RefreshToken): Promise<void>;
  findActiveById(id: string, at: Date): Promise<RefreshToken | null>;
  registerUse(id: string, lastUsedAt: Date): Promise<void>;
  revoke(id: string, revokedAt: Date, reason: RefreshTokenRevokeReason): Promise<void>;
  revokeAllFromUser(userId: string, revokedAt: Date, reason: RefreshTokenRevokeReason): Promise<void>;
}

export interface RefreshTokensGateway {
  revokeAllFromUser(userId: string): Promise<void>;
}

export interface AuthenticatedContext {
  userId: string;
  sessionId: string;
}
