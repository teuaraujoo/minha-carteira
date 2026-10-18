import type { AccountSessionCoordinator } from "../../src/modules/auth/application/contracts/account-session-coordinator.js";

export const accountSessionCoordinatorDouble: AccountSessionCoordinator = {
  createSessionIfAccountActive: async () => false,
  deactivateAccountAndRevokeSessions: async () => false,
  reactivateAccountAndRevokeSessions: async () => ({ found: false, reactivated: false }),
};
