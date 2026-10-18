import { RefreshTokenRevokeReason as PrismaRefreshTokenRevokeReason } from "../../../../../generated/prisma/enums.js";
import type { PrismaClient } from "../../../../../generated/prisma/client.js";
import { RefreshToken } from "../../domain/entities/refresh-token.entity.js";
import type { RefreshTokenProps } from "../../domain/interfaces/auth.interfaces.js";
import { RefreshTokenRevokeReason } from "../../domain/enums/auth.enums.js";
import type { IRefreshTokenRepository } from "../../domain/interfaces/refresh-tokens-repository.interface.js";

export type PrismaRefreshTokensClient = Pick<PrismaClient, "refreshToken">;

interface RefreshTokenRecord extends RefreshTokenProps { }

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaRefreshTokensClient) { }

  async save(refreshToken: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: refreshToken.id,
        userId: refreshToken.userId,
        tokenHash: refreshToken.tokenHash,
        issuedAt: refreshToken.issuedAt,
        expiresAt: refreshToken.expiresAt,
        lastUsedAt: refreshToken.lastUsedAt,
        revokedAt: refreshToken.revokedAt,
        userAgent: refreshToken.userAgent,
        ipAddress: refreshToken.ipAddress,
        revokeReason: refreshToken.revokeReason === null
          ? null
          : PrismaRefreshTokenRevokeReason[refreshToken.revokeReason],
        createdAt: refreshToken.createdAt,
        updatedAt: refreshToken.updatedAt,
      },
    });
  }

  async findActiveById(id: string, at: Date): Promise<RefreshToken | null> {
    const record = await this.prisma.refreshToken.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: at } },
    });
    return record ? this.toDomain(record as RefreshTokenRecord) : null;
  }

  async registerUse(id: string, lastUsedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null, expiresAt: { gt: lastUsedAt } },
      data: { lastUsedAt },
    });
  }

  async revoke(id: string, revokedAt: Date, reason: RefreshTokenRevokeReason): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt, revokeReason: PrismaRefreshTokenRevokeReason[reason] },
    });
  }

  async revokeAllFromUser(
    userId: string,
    revokedAt: Date,
    reason: RefreshTokenRevokeReason,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt, revokeReason: PrismaRefreshTokenRevokeReason[reason] },
    });
  }

  private toDomain(record: RefreshTokenRecord): RefreshToken {
    return new RefreshToken({
      ...record,
      revokeReason: record.revokeReason as RefreshTokenRevokeReason | null,
    });
  }
}
