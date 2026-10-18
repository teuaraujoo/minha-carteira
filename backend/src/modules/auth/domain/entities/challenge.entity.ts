import {
    ChallengePurpose,
    ChallengeStatus,
    ChallengeSubjectType,
} from "../enums/auth.enums.js";
import type { ChallengeMetadata, ChallengeProps } from "../interfaces/auth.interfaces.js";
import { cloneChallengeMetadata, enumValue, nullableDate, required, validDate } from "../utils/auth.utils.js";




export class Challenge {
    readonly id: string;
    readonly purpose: ChallengePurpose;
    readonly subjectType: ChallengeSubjectType;
    readonly subjectId: string;
    readonly secretHash: string;
    readonly status: ChallengeStatus;
    readonly attempts: number;
    readonly maxAttempts: number;
    private readonly challengeMetadata: ChallengeMetadata;
    private readonly challengeExpiresAt: Date;
    private readonly challengeConsumedAt: Date | null;
    private readonly challengeCreatedAt: Date;
    private readonly challengeUpdatedAt: Date;

    constructor(props: ChallengeProps) {
        this.id = required(props.id, "ID do desafio");
        this.purpose = enumValue(props.purpose, ChallengePurpose, "finalidade do desafio");
        this.subjectType = enumValue(props.subjectType, ChallengeSubjectType, "tipo do sujeito do desafio");
        this.subjectId = required(props.subjectId, "ID do sujeito do desafio");
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
    get createdAt(): Date { return new Date(this.challengeCreatedAt.getTime()); }
    get updatedAt(): Date { return new Date(this.challengeUpdatedAt.getTime()); }

    isUsableAt(at: Date): boolean {
        return this.status === ChallengeStatus.REQUESTED
            && this.attempts < this.maxAttempts
            && this.challengeExpiresAt.getTime() > validDate(at, "data de validação").getTime();
    }
}
