import assert from "node:assert/strict";
import test from "node:test";
import type { ClockProvider } from "../../src/shared/application/clock-provider.js";
import type {
  RefreshTokensGateway,
} from "../../src/modules/auth/application/contracts/auth.contracts.js";
import type { RefreshTokenRepository } from "../../src/modules/auth/domain/interfaces/refresh-tokens-repository.interface.js";
import { RefreshToken, type RefreshTokenProps } from "../../src/modules/auth/domain/entities/auth.entities.js";
import { RefreshTokenRevokeReason } from "../../src/modules/auth/domain/enums/auth.enums.js";
import { PrismaRefreshTokenRepository, type PrismaRefreshTokensClient } from "../../src/modules/auth/infrastructure/repositories/refresh-token.repository.js";
import { AuthService } from "../../src/modules/auth/application/services/auth.service.js";

const issuedAt = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2026-01-06T00:00:00.000Z");

function record(overrides: Partial<RefreshTokenProps> = {}): RefreshTokenProps {
  return {
    id: "session-1", userId: "user-1", tokenHash: "sha256-hash", issuedAt, expiresAt,
    lastUsedAt: null, revokedAt: null, userAgent: "browser", ipAddress: "127.0.0.1",
    revokeReason: null, createdAt: issuedAt, updatedAt: issuedAt, ...overrides,
  };
}

function createPrismaFake(initial: RefreshTokenProps[] = []) {
  const rows = [...initial];
  const calls: Array<{ method: string; args: Record<string, unknown> }> = [];
  const matches = (row: RefreshTokenProps, where: Record<string, unknown>): boolean => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "gt" in value) {
      return row[key as keyof RefreshTokenProps] instanceof Date
        && (row[key as keyof RefreshTokenProps] as Date) > (value as { gt: Date }).gt;
    }
    return row[key as keyof RefreshTokenProps] === value;
  });
  const prisma = {
    refreshToken: {
      async create(args: { data: RefreshTokenProps }) {
        calls.push({ method: "create", args });
        rows.push(args.data);
        return args.data;
      },
      async findFirst(args: { where: Record<string, unknown> }) {
        calls.push({ method: "findFirst", args });
        return rows.find(row => matches(row, args.where)) ?? null;
      },
      async updateMany(args: { where: Record<string, unknown>; data: Partial<RefreshTokenProps> }) {
        calls.push({ method: "updateMany", args });
        let count = 0;
        for (let index = 0; index < rows.length; index += 1) {
          const current = rows[index]!;
          if (!matches(current, args.where)) continue;
          rows[index] = { ...current, ...args.data };
          count += 1;
        }
        return { count };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaRefreshTokensClient, rawPrisma: prisma, rows, calls };
}

test("persiste somente hash da credencial e consulta somente sessão ativa", async () => {
  const fake = createPrismaFake();
  const repository = new PrismaRefreshTokenRepository(fake.prisma);
  const session = new RefreshToken(record());

  await repository.save(session);
  assert.equal(fake.rows[0]?.tokenHash, "sha256-hash");
  assert.equal("token" in fake.rows[0]!, false);
  assert.deepEqual(fake.calls[0], {
    method: "create",
    args: { data: record() },
  });

  const active = await repository.findActiveById("session-1", issuedAt);
  assert.equal(active?.tokenHash, "sha256-hash");
  assert.deepEqual(fake.calls[1], {
    method: "findFirst",
    args: { where: { id: "session-1", revokedAt: null, expiresAt: { gt: issuedAt } } },
  });
  assert.equal(await repository.findActiveById("session-1", expiresAt), null);
});

test("registra uso e revoga sessão individual ou todas as sessões com motivo tipado", async () => {
  const fake = createPrismaFake([record(), record({ id: "session-2" })]);
  const repository = new PrismaRefreshTokenRepository(fake.prisma);
  const usedAt = new Date("2026-01-02T00:00:00.000Z");

  await repository.registerUse("session-1", usedAt);
  await repository.revoke("session-1", usedAt, RefreshTokenRevokeReason.LOGOUT);
  await repository.revokeAllFromUser("user-1", usedAt, RefreshTokenRevokeReason.SECURITY_EVENT);

  assert.equal(fake.rows[0]?.lastUsedAt?.getTime(), usedAt.getTime());
  assert.equal(fake.rows[0]?.revokeReason, RefreshTokenRevokeReason.LOGOUT);
  assert.equal(fake.rows[1]?.revokeReason, RefreshTokenRevokeReason.SECURITY_EVENT);
});

test("gateway público revoga sessões por desativação sem expor o repository", async () => {
  const at = new Date("2026-01-03T00:00:00.000Z");
  let call: { userId: string; at: Date; reason: RefreshTokenRevokeReason } | undefined;
  const repository = {
    async revokeAllFromUser(userId: string, revokedAt: Date, reason: RefreshTokenRevokeReason) {
      call = { userId, at: revokedAt, reason };
    },
  } as Pick<RefreshTokenRepository, "revokeAllFromUser"> as RefreshTokenRepository;
  const clock: ClockProvider = { now: () => at };
  const gateway: RefreshTokensGateway = new AuthService(repository, clock, { hash: async () => "", matches: async () => false }, { hash: async () => "", compare: async () => false }, { findCredentialsByIdentifier: async () => null, findActiveUserById: async () => null, findActivePasswordResetRecipient: async () => null, findActivePasswordResetRecipientById: async () => null, changePasswordHash: async () => undefined }, { signAccessToken: async () => "", signRefreshToken: async () => "", verifyAccessToken: async () => { throw new Error("Não esperado."); }, verifyRefreshToken: async () => { throw new Error("Não esperado."); } }, { generate: () => "" });

  await gateway.revokeAllFromUser("user-1");
  assert.deepEqual(call, {
    userId: "user-1", at,
    reason: RefreshTokenRevokeReason.USER_DEACTIVATED,
  });
});
