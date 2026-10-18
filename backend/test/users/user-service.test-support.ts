import { UserService } from "../../src/modules/users/application/services/users.service.js";
import { noopLogger } from "../../src/shared/application/logging/app-logger.js";
import type { StorageOperations } from "../../src/modules/storage/domain/interfaces/storage.interfaces.js";
import type { IUsersRepository } from "../../src/modules/users/domain/interfaces/users-repository.interface.js";
import type { AccountSessionCoordinator } from "../../src/modules/auth/application/contracts/account-session-coordinator.js";

export function createUserService(
  repository: IUsersRepository,
  storage: StorageOperations,
  logger = noopLogger,
  accountSessionCoordinator: AccountSessionCoordinator = {
    createSessionIfAccountActive: async () => true,
    deactivateAccountAndRevokeSessions: async () => true,
    reactivateAccountAndRevokeSessions: async () => ({ found: true, reactivated: true }),
  },
): UserService {
  return new UserService(
    repository,
    storage,
    logger,
    { hash: async (password: string) => `hashed:${password}`, compare: async () => false },
    { generate: () => "new-user-id" },
    { now: () => new Date("2026-01-01T00:00:00.000Z") },
    accountSessionCoordinator,
  );
}
