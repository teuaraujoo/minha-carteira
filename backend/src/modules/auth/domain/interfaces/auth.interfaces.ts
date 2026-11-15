import type {
    ChallengePurpose,
    ChallengeStatus,
    ChallengeSubjectType,
    RefreshTokenRevokeReason
} from "../enums/auth.enums.js";

export interface RefreshTokenProps {
    id: string;
    userId: string;
    tokenHash: string;
    issuedAt: Date;
    expiresAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    userAgent: string | null;
    ipAddress: string | null;
    revokeReason: RefreshTokenRevokeReason | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChallengeProps {
  id: string;
  purpose: ChallengePurpose;
  subjectType: ChallengeSubjectType;
  subjectId: string | null;
  targetEmail?: string | null | undefined;
  secretHash: string;
  status: ChallengeStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: Date | null | undefined;
  metadata: ChallengeMetadata;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestMetadata {
    location: { latitude: number; longitude: number } | null;
    userAgent: string | null;
    ipAddress: string | null;
    deviceId: string | null;
}

export interface ChallengeTokenPayloadMetadata {
  sub: string;
  iss: string;
  jti: string;
  iat: number;
  exp: number;
  type: "access" | "onboarding";
  sid?: string;
  cid?: string;
}

export interface ChallengeMetadata {
  issued: RequestMetadata;
  consumed: RequestMetadata | null;
  tokenPayload?: ChallengeTokenPayloadMetadata | null | undefined;
}