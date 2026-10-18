import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "../../src/modules/users/domain/entities/users.entity.js";
import type { PaginationMeta } from "../../src/shared/application/contracts/pagination.contract.js";
import { createUsersRepositoryDouble } from "./users-repository.double.js";

test("users repository exposes a typed inactive-user pagination result", async () => {
  const repository = createUsersRepositoryDouble();
  const cutoff = new Date("2026-01-01T00:00:00.000Z");
  const pagination = { page: 2, pageSize: 10, offset: 10 };
  const result: { items: User[]; pagination: PaginationMeta } = await repository.findInactiveBefore(cutoff, pagination);

  assert.deepEqual(result, {
    items: [],
    pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
  });
});
