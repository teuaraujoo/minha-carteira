import type { RefreshToken } from "../../domain/entities/auth.entities.js";

export interface AccountReactivationResult {
  found: boolean;
  reactivated: boolean;
}

export interface AccountSessionCoordinator {
  createSessionIfAccountActive(session: RefreshToken): Promise<boolean>;
  deactivateAccountAndRevokeSessions(userId: string, at: Date): Promise<boolean>;
  reactivateAccountAndRevokeSessions(userId: string, at: Date): Promise<AccountReactivationResult>;
}
