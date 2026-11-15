import { randomUUID } from "node:crypto";
import { TransactionStatus, TransactionType } from "../enums/transaction.enums.js";
import type { CreateTransactionProps, TransactionProps } from "../interfaces/transaction.interfaces.js";

const MIN_DESCRIPTION_LENGTH = 2;
const MAX_DESCRIPTION_LENGTH = 120;
const MAX_NOTES_LENGTH = 500;
export const MAX_TRANSACTION_AMOUNT = 999_999_999_999.99;
const ISO_CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valida se a string representa uma data civil real no formato YYYY-MM-DD. */
export function validateTransactionDate(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("A data da transação deve ser um texto no formato YYYY-MM-DD.");
  }
  const trimmed = value.trim();
  if (!ISO_CIVIL_DATE_PATTERN.test(trimmed)) {
    throw new TypeError("A data da transação deve estar no formato YYYY-MM-DD.");
  }

  const [yearPart, monthPart, dayPart] = trimmed.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(utcDate.getTime()) ||
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new RangeError("A data da transação informada não existe no calendário.");
  }

  return trimmed;
}

export class Transaction {
  private readonly transactionId: string;
  private readonly transactionUserId: string;
  private readonly transactionAccountId: string;
  private readonly transactionCategoryId: string | null;
  private readonly transactionDescription: string;
  private readonly transactionAmount: number;
  private readonly transactionType: TransactionType;
  private transactionStatus: TransactionStatus;
  private readonly transactionCivilDate: string;
  private readonly transactionNotes: string | null;
  private transactionConfirmedAt: Date | null;
  private readonly transactionCreatedAt: Date;
  private transactionUpdatedAt: Date;
  private transactionDeletedAt: Date | null;

  constructor(props: TransactionProps) {
    this.transactionId = validateRequiredText(props.id, "ID da transação");
    this.transactionUserId = validateRequiredText(props.userId, "ID do usuário");
    this.transactionAccountId = validateRequiredText(props.accountId, "ID da conta");
    this.transactionCategoryId = normalizeOptionalText(props.categoryId, "ID da categoria");
    this.transactionDescription = validateDescription(props.description);
    this.transactionAmount = validatePositiveCurrencyAmount(props.amount);
    this.transactionType = validateEnumValue(props.type, TransactionType, "tipo da transação");
    this.transactionStatus = validateEnumValue(props.status, TransactionStatus, "status da transação");
    this.transactionCivilDate = validateTransactionDate(props.transactionDate);
    this.transactionNotes = normalizeOptionalNotes(props.notes);
    this.transactionCreatedAt = copyValidDate(props.createdAt, "createdAt");
    this.transactionUpdatedAt = copyValidDate(props.updatedAt, "updatedAt");
    this.transactionConfirmedAt = props.confirmedAt === null
      ? null
      : copyValidDate(props.confirmedAt, "confirmedAt");
    this.transactionDeletedAt = props.deletedAt === null
      ? null
      : copyValidDate(props.deletedAt, "deletedAt");

    if (this.transactionUpdatedAt < this.transactionCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }
    if (this.transactionStatus === TransactionStatus.PENDING && this.transactionConfirmedAt !== null) {
      throw new TypeError("Transação pendente não pode possuir confirmedAt.");
    }
  }

  static create(props: CreateTransactionProps): Transaction {
    const now = copyValidDate(props.now ?? new Date(), "data de criação");
    const status = props.status ?? TransactionStatus.CONFIRMED;
    const confirmedAt = status === TransactionStatus.CONFIRMED ? now : null;

    return new Transaction({
      id: props.id ?? randomUUID(),
      userId: props.userId,
      accountId: props.accountId,
      categoryId: props.categoryId ?? null,
      description: props.description,
      amount: props.amount,
      type: props.type,
      status,
      transactionDate: props.transactionDate,
      notes: props.notes ?? null,
      confirmedAt,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  get id(): string { return this.transactionId; }
  get userId(): string { return this.transactionUserId; }
  get accountId(): string { return this.transactionAccountId; }
  get categoryId(): string | null { return this.transactionCategoryId; }
  get description(): string { return this.transactionDescription; }
  get amount(): number { return this.transactionAmount; }
  get type(): TransactionType { return this.transactionType; }
  get status(): TransactionStatus { return this.transactionStatus; }
  get transactionDate(): string { return this.transactionCivilDate; }
  get notes(): string | null { return this.transactionNotes; }
  get confirmedAt(): Date | null {
    return this.transactionConfirmedAt ? new Date(this.transactionConfirmedAt.getTime()) : null;
  }
  get createdAt(): Date { return new Date(this.transactionCreatedAt.getTime()); }
  get updatedAt(): Date { return new Date(this.transactionUpdatedAt.getTime()); }
  get deletedAt(): Date | null {
    return this.transactionDeletedAt ? new Date(this.transactionDeletedAt.getTime()) : null;
  }

  /** Retorna o impacto financeiro assinado sobre o saldo da conta (+ para receita, - para despesa). */
  getSignedBalanceDelta(): number {
    return this.transactionType === TransactionType.INCOME
      ? this.transactionAmount
      : -this.transactionAmount;
  }

  /** Confirma uma transação pendente (INCOME ou EXPENSE), registrando confirmedAt. */
  confirm(confirmedAt: Date = new Date()): void {
    const nextConfirmedAt = copyValidDate(confirmedAt, "confirmedAt");
    if (this.transactionDeletedAt !== null) {
      throw new TypeError("Uma transação excluída não pode ser confirmada.");
    }
    if (this.transactionStatus !== TransactionStatus.PENDING) {
      throw new TypeError("Apenas transações pendentes podem ser confirmadas.");
    }
    if (nextConfirmedAt < this.transactionCreatedAt) {
      throw new RangeError("confirmedAt não pode ser anterior a createdAt.");
    }

    this.transactionStatus = TransactionStatus.CONFIRMED;
    this.transactionConfirmedAt = nextConfirmedAt;
    this.transactionUpdatedAt = nextConfirmedAt;
  }

  /** Realiza a exclusão lógica da transação mantendo o registro histórico imutável. */
  softDelete(deletedAt: Date = new Date()): void {
    const nextDeletedAt = copyValidDate(deletedAt, "deletedAt");
    if (this.transactionDeletedAt !== null) {
      throw new TypeError("A transação já foi excluída.");
    }
    if (nextDeletedAt < this.transactionCreatedAt) {
      throw new RangeError("deletedAt não pode ser anterior a createdAt.");
    }

    this.transactionDeletedAt = nextDeletedAt;
    this.transactionUpdatedAt = nextDeletedAt;
  }

  toJSON(): TransactionProps {
    return {
      id: this.transactionId,
      userId: this.transactionUserId,
      accountId: this.transactionAccountId,
      categoryId: this.transactionCategoryId,
      description: this.transactionDescription,
      amount: this.transactionAmount,
      type: this.transactionType,
      status: this.transactionStatus,
      transactionDate: this.transactionCivilDate,
      notes: this.transactionNotes,
      confirmedAt: this.confirmedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}

function validateRequiredText(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} é obrigatório.`);
  }
  return value.trim();
}

function normalizeOptionalText(value: string | null | undefined, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError(`${field} deve ser um texto.`);
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validateDescription(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("A descrição da transação deve ser um texto.");
  }
  const trimmed = value.trim();
  if (trimmed.length < MIN_DESCRIPTION_LENGTH || trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new RangeError(
      `A descrição da transação deve possuir entre ${MIN_DESCRIPTION_LENGTH} e ${MAX_DESCRIPTION_LENGTH} caracteres.`,
    );
  }
  return trimmed;
}

function normalizeOptionalNotes(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError("As observações da transação devem ser um texto.");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw new RangeError(`As observações devem possuir no máximo ${MAX_NOTES_LENGTH} caracteres.`);
  }
  return trimmed;
}

function validatePositiveCurrencyAmount(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("O valor da transação deve ser um número válido.");
  }
  if (value <= 0) {
    throw new RangeError("O valor da transação deve ser maior que zero.");
  }
  if (value > MAX_TRANSACTION_AMOUNT) {
    throw new RangeError("O valor da transação excede o limite máximo permitido.");
  }
  const scaled = value * 100;
  if (Math.abs(Math.round(scaled) - scaled) > 1e-8) {
    throw new RangeError("O valor da transação deve possuir no máximo 2 casas decimais.");
  }
  return Number(value.toFixed(2));
}

function validateEnumValue<T extends Record<string, string>>(value: unknown, enumObject: T, field: string): T[keyof T] {
  if (typeof value !== "string" || !Object.values(enumObject).includes(value)) {
    throw new TypeError(`Valor inválido para ${field}.`);
  }
  return value as T[keyof T];
}

function copyValidDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`Data inválida para ${field}.`);
  }
  return new Date(value.getTime());
}
