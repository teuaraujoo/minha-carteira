import {
  PasswordResetRequestStatus,
} from "../enums/auth.enums.js";
import type { PasswordResetRequestProps, RequestMetadata } from "../interfaces/auth.interfaces.js";
import { cloneRequestMetadata, enumValue, nullableDate, required, validDate } from "../utils/auth.utils.js";

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
