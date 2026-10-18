import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import type { UsersAuthGateway } from "../../../users/index.js";
import type { PasswordResetTransaction, PasswordResetUnitOfWork } from "../../application/contracts/password-reset-unit-of-work.js";
import { PrismaRefreshTokenRepository } from "./refresh-token.repository.js";
import { PrismaPasswordResetRequestRepository } from "./password-reset-request.repository.js";
import { PrismaChallengeRepository } from "./challenge.repository.js";

export type UsersAuthGatewayFactory = (transaction: Prisma.TransactionClient) => UsersAuthGateway;

export class PrismaPasswordResetUnitOfWork implements PasswordResetUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly createUsersGateway: UsersAuthGatewayFactory,
  ) { }

  execute<T>(operation: (transaction: PasswordResetTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((transaction) => operation({
      requests: new PrismaPasswordResetRequestRepository(transaction),
      challenges: new PrismaChallengeRepository(transaction),
      refreshTokens: new PrismaRefreshTokenRepository(transaction),
      users: this.createUsersGateway(transaction),
    }));
  }
}
