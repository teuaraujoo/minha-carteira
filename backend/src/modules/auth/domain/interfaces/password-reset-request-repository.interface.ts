import type { PasswordResetRequest } from "../entities/password-reset-request.entity.js";

export interface IPasswordResetRequestRepository {
  save(request: PasswordResetRequest): Promise<void>;
  findById(id: string): Promise<PasswordResetRequest | null>;
  complete(id: string, completedAt: Date): Promise<boolean>;
  markFailed(id: string, failedAt: Date): Promise<void>;
  deleteWithChallenges(id: string): Promise<void>;
}
