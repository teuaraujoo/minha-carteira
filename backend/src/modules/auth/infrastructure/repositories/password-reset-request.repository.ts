import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import { PasswordResetRequest } from "../../domain/entities/auth.entities.js";
import { PasswordResetRequestStatus as PrismaPasswordResetRequestStatus } from "../../../../../generated/prisma/enums.js";
import { ChallengeSubjectType as PrismaChallengeSubjectType } from "../../../../../generated/prisma/enums.js";
import { ChallengePurpose as PrismaChallengePurpose } from "../../../../../generated/prisma/enums.js";
import { ChallengeStatus as PrismaChallengeStatus } from "../../../../../generated/prisma/enums.js";
import type { RequestMetadata } from "../../domain/entities/auth.entities.js";
import type { PasswordResetRequestRepository } from "../../domain/interfaces/password-reset-request-repository.interface.js";

type PrismaResetClient = Pick<PrismaClient, "passwordResetRequest" | "challenge">;

interface PasswordResetRequestRecord {
  id: string;
  userId: string;
  status: string;
  requestedAt: Date;
  expiresAt: Date;
  metadata: unknown;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaPasswordResetRequestRepository implements PasswordResetRequestRepository {
  constructor(private readonly prisma: PrismaResetClient) { }

  async save(request: PasswordResetRequest): Promise<void> {
    await this.prisma.passwordResetRequest.create({
      data: {
        id: request.id,
        userId: request.userId,
        status: PrismaPasswordResetRequestStatus[request.status],
        requestedAt: request.requestedAt,
        expiresAt: request.expiresAt,
        metadata: toPrismaJson(request.metadata),
        completedAt: request.completedAt,
        cancelledAt: request.cancelledAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<PasswordResetRequest | null> {
    const record = await this.prisma.passwordResetRequest.findUnique({ where: { id } });
    return record ? this.toDomain(record as PasswordResetRequestRecord) : null;
  }

  async complete(id: string, completedAt: Date): Promise<boolean> {
    const result = await this.prisma.passwordResetRequest.updateMany({
      where: { id, status: PrismaPasswordResetRequestStatus.PENDING, expiresAt: { gt: completedAt } },
      data: { status: PrismaPasswordResetRequestStatus.COMPLETED, completedAt, updatedAt: completedAt },
    });
    return result.count === 1;
  }

  async markFailed(id: string, failedAt: Date): Promise<void> {
    await this.prisma.passwordResetRequest.updateMany({
      where: { id, status: PrismaPasswordResetRequestStatus.PENDING },
      data: { status: PrismaPasswordResetRequestStatus.FAILED, updatedAt: failedAt },
    });
  }

  async deleteWithChallenges(id: string): Promise<void> {
    await this.prisma.challenge.deleteMany({
      where: {
        purpose: PrismaChallengePurpose.PASSWORD_RESET,
        subjectType: PrismaChallengeSubjectType.PASSWORD_RESET_REQUEST,
        subjectId: id,
        status: { in: [PrismaChallengeStatus.REQUESTED, PrismaChallengeStatus.COMPLETED, PrismaChallengeStatus.FAILED, PrismaChallengeStatus.EXPIRED] },
      },
    });
    await this.prisma.passwordResetRequest.delete({ where: { id } });
  }

  private toDomain(record: PasswordResetRequestRecord): PasswordResetRequest {
    return new PasswordResetRequest({
      ...record,
      status: record.status as PasswordResetRequest["status"],
      metadata: record.metadata as RequestMetadata,
    });
  }
}

function toPrismaJson(value: RequestMetadata): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
