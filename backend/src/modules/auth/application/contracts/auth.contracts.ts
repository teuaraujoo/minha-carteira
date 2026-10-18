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

export interface RefreshTokensGateway {
  revokeAllFromUser(userId: string): Promise<void>;
}

export interface LogoutSessionInput { sessionId: string | null; }
export interface RefreshSessionInput { refreshToken: string; }
export interface RefreshSessionOutput { accessToken: string; }

export interface AuthenticatedContext {
  userId: string;
  sessionId: string;
}

export interface TokenGenerator {
  generate(): string;
}

export interface PasswordResetEmail {
  email: string;
  resetUrl: string;
}

export interface PasswordChangedEmail {
  email: string;
}

export interface EmailProvider {
  sendPasswordReset(input: PasswordResetEmail): Promise<void>;
  sendPasswordChanged(input: PasswordChangedEmail): Promise<void>;
}

export interface PasswordResetRateLimiter {
  consume(normalizedEmail: string, ipAddress: string, at: Date): boolean;
}
