import {
  RefreshTokenRevokeReason,
} from "../enums/auth.enums.js";
import type { RefreshTokenProps } from "../interfaces/auth.interfaces.js";
import { nullableDate, nullableString, required, validDate } from "../utils/auth.utils.js";

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