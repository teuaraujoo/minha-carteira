import type {
    ChallengePurpose,
    ChallengeStatus,
    ChallengeSubjectType,
    PasswordResetRequestStatus,
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

export interface PasswordResetRequestProps {
    id: string;
    userId: string;
    status: PasswordResetRequestStatus;
    requestedAt: Date;
    expiresAt: Date;
    metadata: RequestMetadata;
    completedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChallengeProps {
    id: string;
    purpose: ChallengePurpose;
    subjectType: ChallengeSubjectType;
    subjectId: string;
    secretHash: string;
    status: ChallengeStatus;
    attempts: number;
    maxAttempts: number;
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

export interface ChallengeMetadata {
    issued: RequestMetadata;
    consumed: RequestMetadata | null;
}