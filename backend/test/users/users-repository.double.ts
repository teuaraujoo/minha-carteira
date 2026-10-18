import type { IUsersRepository } from "../../src/modules/users/domain/interfaces/users-repository.interface.js";

export function createUsersRepositoryDouble(
  overrides: Partial<IUsersRepository> = {},
): IUsersRepository {
  return {
    findById: async () => null,
    findActiveById: async () => null,
    findByEmail: async () => null,
    findByUsername: async () => null,
    findByIdentifier: async () => null,
    save: async () => undefined,
    deleteById: async () => undefined,
    findInactiveBefore: async (_date, pagination) => ({
      items: [],
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: 0,
        totalPages: 0,
      },
    }),
    ...overrides,
  };
}
