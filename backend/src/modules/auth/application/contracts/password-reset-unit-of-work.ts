import type { RefreshTokenRepository } from "../../domain/interfaces/refresh-tokens-repository.interface.js";
import type { ChallengeRepository } from "../../domain/interfaces/challenge-repository.interface.js";
import type { PasswordResetRequestRepository } from "../../domain/interfaces/password-reset-request-repository.interface.js";
import type { UsersAuthGateway } from "../../../users/index.js";

export interface PasswordResetTransaction {
  requests: PasswordResetRequestRepository;
  challenges: ChallengeRepository;
  refreshTokens: RefreshTokenRepository;
  users: UsersAuthGateway;
}

export interface PasswordResetUnitOfWork {
  execute<T>(operation: (transaction: PasswordResetTransaction) => Promise<T>): Promise<T>;
}
