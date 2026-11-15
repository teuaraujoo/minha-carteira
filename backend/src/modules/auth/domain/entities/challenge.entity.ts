import {
    ChallengePurpose,
    ChallengeStatus,
    ChallengeSubjectType,
} from "../enums/auth.enums.js";
import type { ChallengeMetadata, ChallengeProps } from "../interfaces/auth.interfaces.js";
import { cloneChallengeMetadata, enumValue, nullableDate, required, validDate } from "../utils/auth.utils.js";




import { assertChallengeMatchesPolicy } from "../constants/challenge-policies.js";

export class Challenge {
    readonly id: string;
    readonly purpose: ChallengePurpose;
    readonly subjectType: ChallengeSubjectType;
    readonly subjectId: string | null;
    readonly targetEmail: string | null;
    readonly secretHash: string;
    readonly status: ChallengeStatus;
    readonly attempts: number;
    readonly maxAttempts: number;
    private readonly challengeMetadata: ChallengeMetadata;
    private readonly challengeExpiresAt: Date;
    private readonly challengeConsumedAt: Date | null;
    private readonly challengeNextAttemptAt: Date | null;
    private readonly challengeCreatedAt: Date;
    private readonly challengeUpdatedAt: Date;

    constructor(props: ChallengeProps) {
        this.id = required(props.id, "ID do desafio");
        this.purpose = enumValue(props.purpose, ChallengePurpose, "finalidade do desafio");
        this.subjectType = enumValue(props.subjectType, ChallengeSubjectType, "tipo do sujeito do desafio");
        this.subjectId = props.subjectId === null ? null : required(props.subjectId, "ID do sujeito do desafio");
        this.targetEmail = props.targetEmail === undefined || props.targetEmail === null
            ? null
            : required(props.targetEmail, "E-mail alvo do desafio").toLowerCase();
        assertChallengeMatchesPolicy({
            purpose: this.purpose,
            subjectType: this.subjectType,
            subjectId: this.subjectId,
            targetEmail: this.targetEmail,
        });
        this.secretHash = required(props.secretHash, "Hash do segredo do desafio");
        this.status = enumValue(props.status, ChallengeStatus, "status do desafio");
        if (!Number.isInteger(props.attempts) || props.attempts < 0) throw new RangeError("attempts deve ser um inteiro não negativo.");
        if (!Number.isInteger(props.maxAttempts) || props.maxAttempts < 1 || props.attempts > props.maxAttempts) {
            throw new RangeError("maxAttempts deve ser positivo e attempts não pode excedê-lo.");
        }
        this.attempts = props.attempts;
        this.maxAttempts = props.maxAttempts;
        this.challengeMetadata = cloneChallengeMetadata(props.metadata);
        this.challengeExpiresAt = validDate(props.expiresAt, "expiresAt");
        this.challengeConsumedAt = nullableDate(props.consumedAt, "consumedAt");
        this.challengeNextAttemptAt = nullableDate(props.nextAttemptAt ?? null, "nextAttemptAt");
        this.challengeCreatedAt = validDate(props.createdAt, "createdAt");
        this.challengeUpdatedAt = validDate(props.updatedAt, "updatedAt");
        if (this.challengeUpdatedAt < this.challengeCreatedAt) throw new RangeError("updatedAt não pode ser anterior a createdAt.");
        if ((this.status === ChallengeStatus.COMPLETED) !== (this.challengeConsumedAt !== null)) {
            throw new TypeError("consumedAt deve corresponder ao status COMPLETED.");
        }
    }

    get metadata(): ChallengeMetadata { return cloneChallengeMetadata(this.challengeMetadata); }
    get expiresAt(): Date { return new Date(this.challengeExpiresAt.getTime()); }
    get consumedAt(): Date | null { return this.challengeConsumedAt === null ? null : new Date(this.challengeConsumedAt.getTime()); }
    get nextAttemptAt(): Date | null { return this.challengeNextAttemptAt === null ? null : new Date(this.challengeNextAttemptAt.getTime()); }
    get createdAt(): Date { return new Date(this.challengeCreatedAt.getTime()); }
    get updatedAt(): Date { return new Date(this.challengeUpdatedAt.getTime()); }

    isUsableAt(at: Date): boolean {
        return this.status === ChallengeStatus.REQUESTED
            && this.attempts < this.maxAttempts
            && this.challengeExpiresAt.getTime() > validDate(at, "data de validação").getTime();
    }

    isResendAllowedAt(at: Date): boolean {
        const atTime = validDate(at, "data de reenvio").getTime();
        return this.challengeNextAttemptAt === null || this.challengeNextAttemptAt.getTime() <= atTime;
    }
}
