export type { EmailProvider } from "../../../../shared/application/contracts/email-provider.contract.js";
export type {
  AccountReactivationEmail,
  MfaCodeEmail,
  PasswordChangedEmail,
  PasswordResetEmail,
} from "../../../../shared/application/interfaces/auth-emails.interfaces.js";

export interface TokenSubject {
  userId: string;
  sessionId: string;
}

export interface OnboardingTokenSubject {
  email: string;
  challengeId: string;
}

export interface VerifiedToken extends TokenSubject {
  tokenId: string;
  type: "access" | "refresh";
  issuer: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface VerifiedOnboardingToken extends OnboardingTokenSubject {
  tokenId: string;
  type: "onboarding";
  issuer: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface JwtProvider {
  signAccessToken(subject: TokenSubject): Promise<string>;
  signRefreshToken(subject: TokenSubject): Promise<string>;
  signOnboardingToken(subject: OnboardingTokenSubject): Promise<string>;
  verifyAccessToken(token: string): Promise<VerifiedToken>;
  verifyRefreshToken(token: string): Promise<VerifiedToken>;
  verifyOnboardingToken(token: string): Promise<VerifiedOnboardingToken>;
}

export interface TokenHasher {
  hash(token: string): Promise<string>;
  matches(token: string, expectedHash: string): Promise<boolean>;
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

export interface PasswordResetRateLimiter {
  consume(normalizedEmail: string, ipAddress: string, at: Date): boolean;
}
