import { randomUUID } from "node:crypto";
import { AccountStatus, AccountType } from "../enums/account.enums.js";
import type {
  AccountProps,
  CreateAccountProps,
  UpdateAccountDetailsProps,
} from "../interfaces/account.interfaces.js";

const MIN_ACCOUNT_NAME_LENGTH = 2;
const MAX_ACCOUNT_NAME_LENGTH = 80;
const MAX_BRAND_LENGTH = 60;
const MAX_INSTITUTION_LENGTH = 80;
const MAX_BALANCE_AMOUNT = 999_999_999_999.99;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** Normaliza o nome da conta para comparação de unicidade sem espaços externos ou distinção de caixa. */
export function normalizeAccountName(name: string): string {
  if (typeof name !== "string") throw new TypeError("O nome da conta deve ser um texto.");
  return name.trim().toLowerCase();
}

export class Account {
  private readonly accountId: string;
  private readonly accountUserId: string;
  private accountName: string;
  private accountType: AccountType;
  private accountBrand: string | null;
  private accountInstitution: string | null;
  private accountColor: string | null;
  private readonly accountInitialBalance: number;
  private readonly accountCurrentBalance: number;
  private accountStatus: AccountStatus;
  private accountInactivatedAt: Date | null;
  private readonly accountCreatedAt: Date;
  private accountUpdatedAt: Date;

  constructor(props: AccountProps) {
    this.accountId = validateRequiredText(props.id, "ID da conta");
    this.accountUserId = validateRequiredText(props.userId, "ID do usuário");
    this.accountName = validateAccountName(props.name);
    this.accountType = validateEnumValue(props.type, AccountType, "tipo de conta");
    this.accountBrand = normalizeOptionalText(props.brand, "Bandeira", MAX_BRAND_LENGTH);
    this.accountInstitution = normalizeOptionalText(props.institution, "Instituição", MAX_INSTITUTION_LENGTH);
    this.accountColor = normalizeOptionalColor(props.color);
    this.accountInitialBalance = validateMonetaryValue(props.initialBalance, "Saldo inicial", { allowNegative: false });
    this.accountCurrentBalance = validateMonetaryValue(props.currentBalance, "Saldo atual", { allowNegative: true });
    this.accountStatus = validateEnumValue(props.status, AccountStatus, "status da conta");
    this.accountCreatedAt = copyValidDate(props.createdAt, "createdAt");
    this.accountUpdatedAt = copyValidDate(props.updatedAt, "updatedAt");
    this.accountInactivatedAt = props.inactivatedAt === null
      ? null
      : copyValidDate(props.inactivatedAt, "inactivatedAt");

    if (this.accountUpdatedAt < this.accountCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }
    if (this.accountStatus === AccountStatus.ACTIVE && this.accountInactivatedAt !== null) {
      throw new TypeError("Conta ativa não pode possuir inactivatedAt.");
    }
    if (this.accountStatus === AccountStatus.INACTIVE && this.accountInactivatedAt === null) {
      throw new TypeError("Conta inativa deve possuir inactivatedAt.");
    }
  }

  static create(props: CreateAccountProps): Account {
    const now = copyValidDate(props.now ?? new Date(), "data de criação");
    const initialBalance = validateMonetaryValue(props.initialBalance, "Saldo inicial", { allowNegative: false });

    return new Account({
      id: props.id ?? randomUUID(),
      userId: props.userId,
      name: props.name,
      type: props.type,
      brand: props.brand ?? null,
      institution: props.institution ?? null,
      color: props.color ?? null,
      initialBalance,
      currentBalance: initialBalance,
      status: AccountStatus.ACTIVE,
      inactivatedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): string { return this.accountId; }
  get userId(): string { return this.accountUserId; }
  get name(): string { return this.accountName; }
  get normalizedName(): string { return normalizeAccountName(this.accountName); }
  get type(): AccountType { return this.accountType; }
  get brand(): string | null { return this.accountBrand; }
  get institution(): string | null { return this.accountInstitution; }
  get color(): string | null { return this.accountColor; }
  get initialBalance(): number { return this.accountInitialBalance; }
  get currentBalance(): number { return this.accountCurrentBalance; }
  get status(): AccountStatus { return this.accountStatus; }
  get inactivatedAt(): Date | null {
    return this.accountInactivatedAt === null ? null : new Date(this.accountInactivatedAt.getTime());
  }
  get createdAt(): Date { return new Date(this.accountCreatedAt.getTime()); }
  get updatedAt(): Date { return new Date(this.accountUpdatedAt.getTime()); }

  /** Atualiza exclusivamente metadados cadastrais/visuais sem alterar saldos. */
  updateDetails(props: UpdateAccountDetailsProps, updatedAt: Date = new Date()): void {
    const nextUpdatedAt = copyValidDate(updatedAt, "updatedAt");
    if (nextUpdatedAt < this.accountCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }

    const nextName = props.name !== undefined ? validateAccountName(props.name) : this.accountName;
    const nextType = props.type !== undefined ? validateEnumValue(props.type, AccountType, "tipo de conta") : this.accountType;
    const nextBrand = props.brand !== undefined
      ? normalizeOptionalText(props.brand, "Bandeira", MAX_BRAND_LENGTH)
      : this.accountBrand;
    const nextInstitution = props.institution !== undefined
      ? normalizeOptionalText(props.institution, "Instituição", MAX_INSTITUTION_LENGTH)
      : this.accountInstitution;
    const nextColor = props.color !== undefined
      ? normalizeOptionalColor(props.color)
      : this.accountColor;

    this.accountName = nextName;
    this.accountType = nextType;
    this.accountBrand = nextBrand;
    this.accountInstitution = nextInstitution;
    this.accountColor = nextColor;
    this.accountUpdatedAt = nextUpdatedAt;
  }

  deactivate(at: Date = new Date()): void {
    if (this.accountStatus === AccountStatus.INACTIVE) {
      throw new Error("Esta conta já está inativa.");
    }
    const validAt = copyValidDate(at, "data de desativação");
    if (validAt < this.accountCreatedAt) {
      throw new RangeError("A data de desativação não pode ser anterior à criação da conta.");
    }
    this.accountStatus = AccountStatus.INACTIVE;
    this.accountInactivatedAt = validAt;
    this.accountUpdatedAt = validAt;
  }

  reactivate(at: Date = new Date()): void {
    if (this.accountStatus === AccountStatus.ACTIVE) {
      throw new Error("Esta conta já está ativa.");
    }
    const validAt = copyValidDate(at, "data de reativação");
    if (validAt < this.accountCreatedAt) {
      throw new RangeError("A data de reativação não pode ser anterior à criação da conta.");
    }
    this.accountStatus = AccountStatus.ACTIVE;
    this.accountInactivatedAt = null;
    this.accountUpdatedAt = validAt;
  }

  toJSON(): AccountProps {
    return {
      id: this.accountId,
      userId: this.accountUserId,
      name: this.accountName,
      type: this.accountType,
      brand: this.accountBrand,
      institution: this.accountInstitution,
      color: this.accountColor,
      initialBalance: this.accountInitialBalance,
      currentBalance: this.accountCurrentBalance,
      status: this.accountStatus,
      inactivatedAt: this.inactivatedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function validateRequiredText(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${field} é obrigatório.`);
  }
  return value.trim();
}

function validateAccountName(value: string): string {
  const trimmed = validateRequiredText(value, "Nome da conta");
  if (trimmed.length < MIN_ACCOUNT_NAME_LENGTH || trimmed.length > MAX_ACCOUNT_NAME_LENGTH) {
    throw new RangeError(
      `O nome da conta deve possuir entre ${MIN_ACCOUNT_NAME_LENGTH} e ${MAX_ACCOUNT_NAME_LENGTH} caracteres.`,
    );
  }
  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined, field: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new TypeError(`${field} deve ser um texto válido.`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new RangeError(`${field} deve possuir no máximo ${maxLength} caracteres.`);
  }
  return trimmed;
}

function normalizeOptionalColor(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new TypeError("A cor da conta deve ser um texto válido.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    throw new TypeError("A cor da conta deve estar no formato hexadecimal #RRGGBB.");
  }
  return trimmed.toUpperCase();
}

function validateMonetaryValue(
  value: number,
  field: string,
  options: { allowNegative: boolean },
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${field} deve ser um número válido.`);
  }
  if (!options.allowNegative && value < 0) {
    throw new RangeError(`${field} não pode ser negativo.`);
  }
  if (Math.abs(value) > MAX_BALANCE_AMOUNT) {
    throw new RangeError(`${field} excede o limite suportado.`);
  }
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > 1e-9) {
    throw new RangeError(`${field} deve possuir no máximo 2 casas decimais.`);
  }
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validateEnumValue<T extends Record<string, string>>(value: string, values: T, field: string): T[keyof T] {
  if (!Object.values(values).includes(value)) {
    throw new TypeError(`O ${field} é inválido.`);
  }
  return value as T[keyof T];
}

function copyValidDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${field} deve ser uma data válida.`);
  }
  return new Date(value.getTime());
}
