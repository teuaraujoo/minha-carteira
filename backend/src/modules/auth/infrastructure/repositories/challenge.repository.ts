import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";
import { Challenge } from "../../domain/entities/challenge.entity.js";
import {
  ChallengePurpose as PrismaChallengePurpose,
  ChallengeStatus as PrismaChallengeStatus,
  ChallengeSubjectType as PrismaChallengeSubjectType,
} from "../../../../../generated/prisma/enums.js";
import type { ChallengeMetadata } from "../../domain/interfaces/auth.interfaces.js";
import { ChallengePurpose, ChallengeSubjectType } from "../../domain/enums/auth.enums.js";
import type { IChallengeRepository } from "../../domain/interfaces/challenge-repository.interface.js";

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

export class PrismaChallengeRepository implements IChallengeRepository {
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
    return this.registerInvalidAttemptForPurpose(
      id,
      ChallengePurpose.PASSWORD_RESET,
      ChallengeSubjectType.PASSWORD_RESET_REQUEST,
      3,
      attemptedAt,
    );
  }

  async registerInvalidAttemptForPurpose(
    id: string,
    purpose: Challenge["purpose"],
    subjectType: Challenge["subjectType"],
    maxAttempts: number,
    attemptedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.challenge.updateMany({
      where: {
        id,
        purpose: PrismaChallengePurpose[purpose],
        subjectType: PrismaChallengeSubjectType[subjectType],
        status: PrismaChallengeStatus.REQUESTED,
        expiresAt: { gt: attemptedAt },
        attempts: { lt: maxAttempts },
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
    return this.completeIfUsableForPurpose(
      id,
      ChallengePurpose.PASSWORD_RESET,
      ChallengeSubjectType.PASSWORD_RESET_REQUEST,
      3,
      metadata,
      completedAt,
    );
  }

  async completeIfUsableForPurpose(
    id: string,
    purpose: Challenge["purpose"],
    subjectType: Challenge["subjectType"],
    maxAttempts: number,
    metadata: ChallengeMetadata,
    completedAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.challenge.updateMany({
      where: {
        id,
        purpose: PrismaChallengePurpose[purpose],
        subjectType: PrismaChallengeSubjectType[subjectType],
        status: PrismaChallengeStatus.REQUESTED,
        expiresAt: { gt: completedAt },
        attempts: { lt: maxAttempts },
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
