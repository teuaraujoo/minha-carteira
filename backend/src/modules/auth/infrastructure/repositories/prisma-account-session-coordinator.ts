import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import {
  ChallengePurpose,
  ChallengeStatus,
  ChallengeSubjectType,
  RefreshTokenRevokeReason,
  UserStatus,
} from "../../../../../generated/prisma/enums.js";
import type { RefreshToken } from "../../domain/entities/auth.entities.js";
import type { AccountReactivationResult, AccountSessionCoordinator } from "../../application/contracts/account-session-coordinator.js";

type AccountSessionTransaction = Prisma.TransactionClient;

export class PrismaAccountSessionCoordinator implements AccountSessionCoordinator {
  constructor(private readonly prisma: PrismaClient) { }

  createSessionIfAccountActive(session: RefreshToken): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const [account] = await this.lockAccount(transaction, session.userId);
      if (!account || account.status !== UserStatus.ACTIVE) return false;

      await transaction.refreshToken.create({
        data: {
          id: session.id,
          userId: session.userId,
          tokenHash: session.tokenHash,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
          lastUsedAt: session.lastUsedAt,
          revokedAt: session.revokedAt,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          revokeReason: session.revokeReason,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      });
      return true;
    });
  }

  deactivateAccountAndRevokeSessions(userId: string, at: Date): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const [account] = await this.lockAccount(transaction, userId);
      if (!account || account.status !== UserStatus.ACTIVE) return false;

      const updated = await transaction.user.updateMany({
        where: { id: userId, status: UserStatus.ACTIVE },
        data: { status: UserStatus.INACTIVE, inactivatedAt: at, updatedAt: at },
      });
      if (updated.count !== 1) return false;

      await transaction.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: at,
          revokeReason: RefreshTokenRevokeReason.USER_DEACTIVATED,
          updatedAt: at,
        },
      });
      return true;
    });
  }

  reactivateAccountAndRevokeSessions(userId: string, at: Date): Promise<AccountReactivationResult> {
    return this.prisma.$transaction(async (transaction) => {
      const [account] = await this.lockAccount(transaction, userId);
      if (!account) return { found: false, reactivated: false };

      const reactivated = account.status === UserStatus.INACTIVE;
      if (reactivated) {
        const updated = await transaction.user.updateMany({
          where: { id: userId, status: UserStatus.INACTIVE },
          data: { status: UserStatus.ACTIVE, inactivatedAt: null, updatedAt: at },
        });
        if (updated.count !== 1) return { found: false, reactivated: false };

        await transaction.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: at,
            revokeReason: RefreshTokenRevokeReason.USER_DEACTIVATED,
            updatedAt: at,
          },
        });
      }

      await transaction.challenge.updateMany({
        where: {
          purpose: ChallengePurpose.ACCOUNT_REACTIVATION,
          subjectType: ChallengeSubjectType.USER,
          subjectId: userId,
          status: ChallengeStatus.REQUESTED,
        },
        data: { status: ChallengeStatus.FAILED, updatedAt: at },
      });

      return { found: true, reactivated };
    });
  }

  private lockAccount(
    transaction: AccountSessionTransaction,
    userId: string,
  ): Promise<Array<{ status: string }>> {
    return transaction.$queryRaw<Array<{ status: string }>>`
      SELECT status::text AS status
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `;
  }
}
