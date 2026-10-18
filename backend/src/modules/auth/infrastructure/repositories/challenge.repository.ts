import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import { Challenge } from "../../domain/entities/auth.entities.js";
import {
  ChallengePurpose as PrismaChallengePurpose,
  ChallengeStatus as PrismaChallengeStatus,
  ChallengeSubjectType as PrismaChallengeSubjectType,
} from "../../../../../generated/prisma/enums.js";
import type { ChallengeMetadata } from "../../domain/entities/auth.entities.js";
import type { ChallengeRepository } from "../../domain/interfaces/challenge-repository.interface.js";

type PrismaChallengeClient = Pick<PrismaClient, "challenge">;

interface ChallengeRecord {
  id: string;
  purpose: string;
  subjectType: string;
  subjectId: string;
  secretHash: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  metadata: unknown;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaChallengeRepository implements ChallengeRepository {
  constructor(private readonly prisma: PrismaChallengeClient) { }

  async save(challenge: Challenge): Promise<void> {
    await this.prisma.challenge.create({
      data: {
        id: challenge.id,
        purpose: PrismaChallengePurpose[challenge.purpose],
        subjectType: PrismaChallengeSubjectType[challenge.subjectType],
        subjectId: challenge.subjectId,
        secretHash: challenge.secretHash,
        status: PrismaChallengeStatus[challenge.status],
        attempts: challenge.attempts,
        maxAttempts: challenge.maxAttempts,
        metadata: toPrismaJson(challenge.metadata),
        expiresAt: challenge.expiresAt,
        consumedAt: challenge.consumedAt,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Challenge | null> {
    const record = await this.prisma.challenge.findUnique({ where: { id } });
    return record ? this.toDomain(record as ChallengeRecord) : null;
  }

  async registerInvalidAttempt(id: string, attemptedAt: Date): Promise<boolean> {
    const result = await this.prisma.challenge.updateMany({
      where: {
        id,
        purpose: PrismaChallengePurpose.PASSWORD_RESET,
        subjectType: PrismaChallengeSubjectType.PASSWORD_RESET_REQUEST,
        status: PrismaChallengeStatus.REQUESTED,
        expiresAt: { gt: attemptedAt },
        attempts: { lt: 3 },
      },
      data: { attempts: { increment: 1 }, updatedAt: attemptedAt },
    });
    if (result.count !== 1) return false;

    const updated = await this.prisma.challenge.findUnique({ where: { id }, select: { attempts: true, maxAttempts: true } });
    if (updated && updated.attempts >= updated.maxAttempts) {
      await this.prisma.challenge.updateMany({
        where: { id, status: PrismaChallengeStatus.REQUESTED },
        data: { status: PrismaChallengeStatus.FAILED, updatedAt: attemptedAt },
      });
    }
    return true;
  }

  async completeIfUsable(id: string, metadata: ChallengeMetadata, completedAt: Date): Promise<boolean> {
    const result = await this.prisma.challenge.updateMany({
      where: {
        id,
        purpose: PrismaChallengePurpose.PASSWORD_RESET,
        subjectType: PrismaChallengeSubjectType.PASSWORD_RESET_REQUEST,
        status: PrismaChallengeStatus.REQUESTED,
        expiresAt: { gt: completedAt },
        attempts: { lt: 3 },
      },
      data: {
        status: PrismaChallengeStatus.COMPLETED,
        consumedAt: completedAt,
        metadata: toPrismaJson(metadata),
        updatedAt: completedAt,
      },
    });
    return result.count === 1;
  }

  async markFailed(id: string, failedAt: Date): Promise<void> {
    await this.prisma.challenge.updateMany({
      where: { id, status: PrismaChallengeStatus.REQUESTED },
      data: { status: PrismaChallengeStatus.FAILED, updatedAt: failedAt },
    });
  }

  private toDomain(record: ChallengeRecord): Challenge {
    return new Challenge({
      ...record,
      purpose: record.purpose as Challenge["purpose"],
      subjectType: record.subjectType as Challenge["subjectType"],
      status: record.status as Challenge["status"],
      metadata: record.metadata as ChallengeMetadata,
    });
  }
}

function toPrismaJson(value: ChallengeMetadata): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
