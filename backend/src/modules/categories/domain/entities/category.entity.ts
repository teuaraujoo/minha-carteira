import { randomUUID } from "node:crypto";
import { CategoryStatus } from "../enums/category.enums.js";
import type {
  CategoryProps,
  CreateCategoryProps,
  UpdateCategoryDetailsProps,
} from "../interfaces/category.interfaces.js";

const MIN_CATEGORY_NAME_LENGTH = 2;
const MAX_CATEGORY_NAME_LENGTH = 60;
const MAX_ICON_LENGTH = 40;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** Normaliza o nome da categoria para comparação de unicidade sem espaços externos ou distinção de caixa. */
export function normalizeCategoryName(name: string): string {
  if (typeof name !== "string") {
    throw new TypeError("O nome da categoria deve ser um texto.");
  }
  return name.trim().toLowerCase();
}

export class Category {
  private readonly categoryId: string;
  private readonly categoryUserId: string | null;
  private categoryName: string;
  private categoryColor: string | null;
  private categoryIcon: string | null;
  private readonly categoryIsDefault: boolean;
  private categoryStatus: CategoryStatus;
  private readonly categoryCreatedAt: Date;
  private categoryUpdatedAt: Date;

  constructor(props: CategoryProps) {
    this.categoryId = validateRequiredText(props.id, "ID da categoria");
    this.categoryIsDefault = Boolean(props.isDefault);
    this.categoryUserId = props.userId === null ? null : validateRequiredText(props.userId, "ID do usuário");
    this.categoryName = validateCategoryName(props.name);
    this.categoryColor = normalizeOptionalColor(props.color);
    this.categoryIcon = normalizeOptionalIcon(props.icon);
    this.categoryStatus = validateEnumValue(props.status, CategoryStatus, "status da categoria");
    this.categoryCreatedAt = copyValidDate(props.createdAt, "createdAt");
    this.categoryUpdatedAt = copyValidDate(props.updatedAt, "updatedAt");

    if (this.categoryUpdatedAt < this.categoryCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }
    if (this.categoryIsDefault && this.categoryUserId !== null) {
      throw new TypeError("Categoria padrão do sistema não pode possuir userId.");
    }
    if (!this.categoryIsDefault && this.categoryUserId === null) {
      throw new TypeError("Categoria personalizada deve estar vinculada a um usuário.");
    }
  }

  static create(props: CreateCategoryProps): Category {
    const now = copyValidDate(props.now ?? new Date(), "data de criação");
    return new Category({
      id: props.id ?? randomUUID(),
      userId: props.userId,
      name: props.name,
      color: props.color ?? null,
      icon: props.icon ?? null,
      isDefault: false,
      status: CategoryStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): string { return this.categoryId; }
  get userId(): string | null { return this.categoryUserId; }
  get name(): string { return this.categoryName; }
  get normalizedName(): string { return normalizeCategoryName(this.categoryName); }
  get color(): string | null { return this.categoryColor; }
  get icon(): string | null { return this.categoryIcon; }
  get isDefault(): boolean { return this.categoryIsDefault; }
  get status(): CategoryStatus { return this.categoryStatus; }
  get createdAt(): Date { return new Date(this.categoryCreatedAt.getTime()); }
  get updatedAt(): Date { return new Date(this.categoryUpdatedAt.getTime()); }

  /** Verifica se a categoria é padrão do sistema ou pertence ao usuário informado. */
  isAccessibleBy(userId: string): boolean {
    return this.categoryIsDefault || this.categoryUserId === userId;
  }

  /** Atualiza os dados editáveis de uma categoria personalizada. */
  updateDetails(props: UpdateCategoryDetailsProps, updatedAt: Date = new Date()): void {
    this.ensureCustomCategory("editar");
    const nextUpdatedAt = copyValidDate(updatedAt, "updatedAt");
    if (nextUpdatedAt < this.categoryCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }

    const nextName = props.name !== undefined ? validateCategoryName(props.name) : this.categoryName;
    const nextColor = props.color !== undefined ? normalizeOptionalColor(props.color) : this.categoryColor;
    const nextIcon = props.icon !== undefined ? normalizeOptionalIcon(props.icon) : this.categoryIcon;

    this.categoryName = nextName;
    this.categoryColor = nextColor;
    this.categoryIcon = nextIcon;
    this.categoryUpdatedAt = nextUpdatedAt;
  }

  deactivate(updatedAt: Date = new Date()): void {
    this.ensureCustomCategory("desativar");
    const nextUpdatedAt = copyValidDate(updatedAt, "updatedAt");
    if (this.categoryStatus === CategoryStatus.INACTIVE) {
      throw new TypeError("A categoria já está inativa.");
    }
    if (nextUpdatedAt < this.categoryCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }

    this.categoryStatus = CategoryStatus.INACTIVE;
    this.categoryUpdatedAt = nextUpdatedAt;
  }

  reactivate(updatedAt: Date = new Date()): void {
    this.ensureCustomCategory("reativar");
    const nextUpdatedAt = copyValidDate(updatedAt, "updatedAt");
    if (this.categoryStatus === CategoryStatus.ACTIVE) {
      throw new TypeError("A categoria já está ativa.");
    }
    if (nextUpdatedAt < this.categoryCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }

    this.categoryStatus = CategoryStatus.ACTIVE;
    this.categoryUpdatedAt = nextUpdatedAt;
  }

  private ensureCustomCategory(action: string): void {
    if (this.categoryIsDefault) {
      throw new TypeError(`Categorias padrão do sistema não permitem ${action}.`);
    }
  }

  toJSON(): CategoryProps {
    return {
      id: this.categoryId,
      userId: this.categoryUserId,
      name: this.categoryName,
      color: this.categoryColor,
      icon: this.categoryIcon,
      isDefault: this.categoryIsDefault,
      status: this.categoryStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function validateRequiredText(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} é obrigatório.`);
  }
  return value.trim();
}

function validateCategoryName(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("O nome da categoria deve ser um texto.");
  }
  const trimmed = value.trim();
  if (trimmed.length < MIN_CATEGORY_NAME_LENGTH || trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new RangeError(
      `O nome da categoria deve possuir entre ${MIN_CATEGORY_NAME_LENGTH} e ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
    );
  }
  return trimmed;
}

function normalizeOptionalIcon(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError("O ícone da categoria deve ser um texto.");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_ICON_LENGTH) {
    throw new RangeError(`O ícone da categoria deve possuir no máximo ${MAX_ICON_LENGTH} caracteres.`);
  }
  return trimmed;
}

function normalizeOptionalColor(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError("A cor da categoria deve ser um texto.");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    throw new TypeError("A cor da categoria deve estar no formato hexadecimal #RRGGBB.");
  }
  return trimmed.toUpperCase();
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
