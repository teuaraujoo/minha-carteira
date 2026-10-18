import type { Challenge, ChallengeMetadata } from "../entities/auth.entities.js";

export interface ChallengeRepository {
  save(challenge: Challenge): Promise<void>;
  findById(id: string): Promise<Challenge | null>;
  registerInvalidAttempt(id: string, attemptedAt: Date): Promise<boolean>;
  completeIfUsable(id: string, metadata: ChallengeMetadata, completedAt: Date): Promise<boolean>;
  registerInvalidAttemptForPurpose(
    id: string,
    purpose: Challenge["purpose"],
    subjectType: Challenge["subjectType"],
    maxAttempts: number,
    attemptedAt: Date,
  ): Promise<boolean>;
  completeIfUsableForPurpose(
    id: string,
    purpose: Challenge["purpose"],
    subjectType: Challenge["subjectType"],
    maxAttempts: number,
    metadata: ChallengeMetadata,
    completedAt: Date,
  ): Promise<boolean>;
  markFailed(id: string, failedAt: Date): Promise<void>;
}
