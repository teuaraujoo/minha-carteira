import {
  ChallengePurpose,
  ChallengeStatus,
  ChallengeSubjectType,
  PasswordResetRequestStatus,
  RefreshTokenRevokeReason,
} from "../enums/auth.enums.js";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 5 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_MAX_ATTEMPTS = 3;
export const ACCOUNT_REACTIVATION_TOKEN_TTL_MS = 15 * 60 * 1000;
export const ACCOUNT_REACTIVATION_MAX_ATTEMPTS = 3;

export interface RequestMetadata {
  location: { latitude: number; longitude: number } | null;
  userAgent: string | null;
  ipAddress: string | null;
  deviceId: string | null;
}

export interface ChallengeMetadata {
  issued: RequestMetadata;
  consumed: RequestMetadata | null;
}

export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  userAgent: string | null;
  ipAddress: string | null;
  revokeReason: RefreshTokenRevokeReason | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  private readonly tokenIssuedAt: Date;
  private readonly tokenExpiresAt: Date;
  private readonly tokenLastUsedAt: Date | null;
  private readonly tokenRevokedAt: Date | null;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly revokeReason: RefreshTokenRevokeReason | null;
  private readonly tokenCreatedAt: Date;
  private readonly tokenUpdatedAt: Date;

  constructor(props: RefreshTokenProps) {
    this.id = required(props.id, "ID da sessão");
    this.userId = required(props.userId, "ID do usuário");
    this.tokenHash = required(props.tokenHash, "Hash do refresh token");
    this.tokenIssuedAt = validDate(props.issuedAt, "issuedAt");
    this.tokenExpiresAt = validDate(props.expiresAt, "expiresAt");
    if (this.tokenExpiresAt <= this.tokenIssuedAt) {
      throw new RangeError("expiresAt deve ser posterior a issuedAt.");
    }
    this.tokenLastUsedAt = nullableDate(props.lastUsedAt, "lastUsedAt");
    this.tokenRevokedAt = nullableDate(props.revokedAt, "revokedAt");
    this.userAgent = nullableString(props.userAgent, "userAgent");
    this.ipAddress = nullableString(props.ipAddress, "ipAddress");
    this.revokeReason = props.revokeReason;
    if (this.revokeReason !== null && !Object.values(RefreshTokenRevokeReason).includes(this.revokeReason)) {
      throw new TypeError("O motivo de revogação da sessão é inválido.");
    }
    if ((this.tokenRevokedAt === null) !== (this.revokeReason === null)) {
      throw new TypeError("Data e motivo de revogação devem ser informados juntos.");
    }
    this.tokenCreatedAt = validDate(props.createdAt, "createdAt");
    this.tokenUpdatedAt = validDate(props.updatedAt, "updatedAt");
    if (this.tokenUpdatedAt < this.tokenCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }
  }

  get issuedAt(): Date { return new Date(this.tokenIssuedAt.getTime()); }
  get expiresAt(): Date { return new Date(this.tokenExpiresAt.getTime()); }
  get lastUsedAt(): Date | null { return this.tokenLastUsedAt === null ? null : new Date(this.tokenLastUsedAt.getTime()); }
  get revokedAt(): Date | null { return this.tokenRevokedAt === null ? null : new Date(this.tokenRevokedAt.getTime()); }
  get createdAt(): Date { return new Date(this.tokenCreatedAt.getTime()); }
  get updatedAt(): Date { return new Date(this.tokenUpdatedAt.getTime()); }

  isActiveAt(at: Date): boolean {
    const timestamp = validDate(at, "data de validação").getTime();
    return this.tokenRevokedAt === null && this.tokenExpiresAt.getTime() > timestamp;
  }
}

export interface PasswordResetRequestProps {
  id: string;
  userId: string;
  status: PasswordResetRequestStatus;
  requestedAt: Date;
  expiresAt: Date;
  metadata: RequestMetadata;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PasswordResetRequest {
  readonly id: string;
  readonly userId: string;
  readonly status: PasswordResetRequestStatus;
  private readonly requestRequestedAt: Date;
  private readonly requestExpiresAt: Date;
  private readonly requestMetadata: RequestMetadata;
  private readonly requestCompletedAt: Date | null;
  private readonly requestCancelledAt: Date | null;
  private readonly requestCreatedAt: Date;
  private readonly requestUpdatedAt: Date;

  constructor(props: PasswordResetRequestProps) {
    this.id = required(props.id, "ID da solicitação");
    this.userId = required(props.userId, "ID do usuário");
    this.status = enumValue(props.status, PasswordResetRequestStatus, "status da solicitação");
    this.requestRequestedAt = validDate(props.requestedAt, "requestedAt");
    this.requestExpiresAt = validDate(props.expiresAt, "expiresAt");
    if (this.requestExpiresAt <= this.requestRequestedAt) throw new RangeError("expiresAt deve ser posterior a requestedAt.");
    this.requestMetadata = cloneRequestMetadata(props.metadata);
    this.requestCompletedAt = nullableDate(props.completedAt, "completedAt");
    this.requestCancelledAt = nullableDate(props.cancelledAt, "cancelledAt");
    this.requestCreatedAt = validDate(props.createdAt, "createdAt");
    this.requestUpdatedAt = validDate(props.updatedAt, "updatedAt");
    if (this.requestUpdatedAt < this.requestCreatedAt) throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    if ((this.status === PasswordResetRequestStatus.COMPLETED) !== (this.requestCompletedAt !== null)) {
      throw new TypeError("completedAt deve corresponder ao status COMPLETED.");
    }
    if ((this.status === PasswordResetRequestStatus.CANCELLED) !== (this.requestCancelledAt !== null)) {
      throw new TypeError("cancelledAt deve corresponder ao status CANCELLED.");
    }
  }

  get requestedAt(): Date { return new Date(this.requestRequestedAt.getTime()); }
  get expiresAt(): Date { return new Date(this.requestExpiresAt.getTime()); }
  get metadata(): RequestMetadata { return cloneRequestMetadata(this.requestMetadata); }
  get completedAt(): Date | null { return this.requestCompletedAt === null ? null : new Date(this.requestCompletedAt.getTime()); }
  get cancelledAt(): Date | null { return this.requestCancelledAt === null ? null : new Date(this.requestCancelledAt.getTime()); }
  get createdAt(): Date { return new Date(this.requestCreatedAt.getTime()); }
  get updatedAt(): Date { return new Date(this.requestUpdatedAt.getTime()); }

  isPendingAt(at: Date): boolean {
    return this.status === PasswordResetRequestStatus.PENDING
      && this.requestExpiresAt.getTime() > validDate(at, "data de validação").getTime();
  }
}

export interface ChallengeProps {
  id: string;
  purpose: ChallengePurpose;
  subjectType: ChallengeSubjectType;
  subjectId: string;
  secretHash: string;
  status: ChallengeStatus;
  attempts: number;
  maxAttempts: number;
  metadata: ChallengeMetadata;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} é obrigatório.`);
  return value.trim();
}

function nullableString(value: string | null, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError(`${field} deve ser texto ou nulo.`);
  return value;
}

function validDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError(`${field} deve ser uma data válida.`);
  return new Date(value.getTime());
}

function nullableDate(value: Date | null, field: string): Date | null {
  return value === null ? null : validDate(value, field);
}

function enumValue<T extends Record<string, string>>(value: string, values: T, field: string): T[keyof T] {
  if (!Object.values(values).includes(value)) throw new TypeError(`O ${field} é inválido.`);
  return value as T[keyof T];
}

function cloneRequestMetadata(value: RequestMetadata): RequestMetadata {
  if (!value || typeof value !== "object") throw new TypeError("A metadata da solicitação é obrigatória.");
  const location = value.location === null ? null : {
    latitude: finiteNumber(value.location?.latitude, "latitude"),
    longitude: finiteNumber(value.location?.longitude, "longitude"),
  };
  return {
    location,
    userAgent: nullableString(value.userAgent, "userAgent"),
    ipAddress: nullableString(value.ipAddress, "ipAddress"),
    deviceId: nullableString(value.deviceId, "deviceId"),
  };
}

function cloneChallengeMetadata(value: ChallengeMetadata): ChallengeMetadata {
  if (!value || typeof value !== "object") throw new TypeError("A metadata do desafio é obrigatória.");
  return {
    issued: cloneRequestMetadata(value.issued),
    consumed: value.consumed === null ? null : cloneRequestMetadata(value.consumed),
  };
}

function finiteNumber(value: number, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${field} deve ser um número válido.`);
  return value;
}
