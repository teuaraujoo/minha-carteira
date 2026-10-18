import { UserCapabilities, UserRoles, UserStatus } from "../enums/users.enums.js";

export interface UserProps {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRoles;
  passwordHash: string;
  capabilities: UserCapabilities[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
}

export interface UserCreationProps {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  createdAt: Date;
}

export class User {
  private readonly userId: string;
  private userUsername: string;
  private userName: string;
  private userEmail: string;
  private userPhone: string;
  private readonly userRole: UserRoles;
  private userPasswordHash: string;
  private userCapabilities: UserCapabilities[];
  private userStatus: UserStatus;
  private readonly userCreatedAt: Date;
  private userUpdatedAt: Date;
  private userInactivatedAt: Date | null;

  constructor(props: UserProps) {
    this.userId = User.normalizeRequired(props.id, "ID");
    this.userUsername = User.normalizeRequired(props.username, "Nome de usuário").toLowerCase();
    this.userName = User.normalizeRequired(props.name, "Nome");
    this.userEmail = User.normalizeRequired(props.email, "E-mail").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.userEmail)) {
      throw new TypeError("E-mail inválido.");
    }
    this.userPhone = User.normalizeRequired(props.phone, "Telefone");
    this.userRole = User.validateRole(props.role);
    this.userPasswordHash = User.normalizeRequired(props.passwordHash, "Hash da senha");
    this.userCapabilities = User.validateCapabilities(props.capabilities);
    this.userStatus = User.validateStatus(props.status);
    this.userCreatedAt = User.copyValidDate(props.createdAt, "createdAt");
    this.userUpdatedAt = User.copyValidDate(props.updatedAt, "updatedAt");
    this.userInactivatedAt = props.inactivatedAt === null
      ? null
      : User.copyValidDate(props.inactivatedAt, "inactivatedAt");

    if (this.userUpdatedAt < this.userCreatedAt) {
      throw new RangeError("updatedAt não pode ser anterior a createdAt.");
    }
    if (this.userStatus === UserStatus.ACTIVE && this.userInactivatedAt !== null) {
      throw new TypeError("Usuário ativo não pode possuir inactivatedAt.");
    }
    if (this.userStatus === UserStatus.INACTIVE && this.userInactivatedAt === null) {
      throw new TypeError("Usuário inativo deve possuir inactivatedAt.");
    }
  }

  static create(props: UserCreationProps): User {
    const createdAt = User.copyValidDate(props.createdAt, "createdAt");
    return new User({
      ...props,
      role: UserRoles.USER,
      capabilities: [],
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt: createdAt,
      inactivatedAt: null,
    });
  }

  get id(): string {
    return this.userId;
  }

  get username(): string {
    return this.userUsername;
  }

  get name(): string {
    return this.userName;
  }

  get email(): string {
    return this.userEmail;
  }

  get phone(): string {
    return this.userPhone;
  }

  get role(): UserRoles {
    return this.userRole;
  }

  get passwordHash(): string {
    return this.userPasswordHash;
  }

  get capabilities(): UserCapabilities[] {
    return [...this.userCapabilities];
  }

  get status(): UserStatus {
    return this.userStatus;
  }

  get createdAt(): Date {
    return new Date(this.userCreatedAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.userUpdatedAt.getTime());
  }

  get inactivatedAt(): Date | null {
    return this.userInactivatedAt === null
      ? null
      : new Date(this.userInactivatedAt.getTime());
  }

  toJSON(): Omit<UserProps, "passwordHash"> {
    return {
      id: this.id,
      username: this.username,
      name: this.name,
      email: this.email,
      phone: this.phone,
      role: this.role,
      capabilities: this.capabilities,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      inactivatedAt: this.inactivatedAt,
    };
  }

  isActive(): boolean {
    return this.userStatus === UserStatus.ACTIVE;
  }

  changePasswordHash(passwordHash: string, at: Date = new Date()): void {
    const normalizedHash = User.normalizeRequired(passwordHash, "Hash da senha");
    if (normalizedHash === this.userPasswordHash) {
      return;
    }

    this.validateMutationDate(at);
    this.userPasswordHash = normalizedHash;
    this.touch(at);
  }

  activate(at: Date = new Date()): void {
    if (this.userStatus === UserStatus.ACTIVE) {
      return;
    }

    this.validateMutationDate(at);
    this.userStatus = UserStatus.ACTIVE;
    this.userInactivatedAt = null;
    this.touch(at);
  }

  deactivate(at: Date = new Date()): void {
    if (this.userStatus === UserStatus.INACTIVE) {
      return;
    }

    this.validateMutationDate(at);
    this.userStatus = UserStatus.INACTIVE;
    this.userInactivatedAt = new Date(at.getTime());
    this.touch(at);
  }

  hasCapability(capability: UserCapabilities): boolean {
    User.validateCapability(capability);
    return this.userCapabilities.includes(capability);
  }

  grantCapability(capability: UserCapabilities, at: Date = new Date()): void {
    User.validateCapability(capability);
    if (this.hasCapability(capability)) {
      return;
    }

    this.validateMutationDate(at);
    this.userCapabilities.push(capability);
    this.touch(at);
  }

  revokeCapability(capability: UserCapabilities, at: Date = new Date()): void {
    User.validateCapability(capability);
    if (!this.hasCapability(capability)) {
      return;
    }

    this.validateMutationDate(at);
    this.userCapabilities = this.userCapabilities.filter(
      currentCapability => currentCapability !== capability,
    );
    this.touch(at);
  }

  private validateMutationDate(at: Date): void {
    const timestamp = at instanceof Date ? at.getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError("A data da alteração deve ser válida.");
    }
    if (timestamp < this.userUpdatedAt.getTime()) {
      throw new RangeError("A data da alteração não pode ser anterior a updatedAt.");
    }
  }

  private touch(at: Date): void {
    this.userUpdatedAt = new Date(at.getTime());
  }

  private static normalizeRequired(value: string, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError(`${field} é obrigatório.`);
    }
    return value.trim();
  }

  private static copyValidDate(value: Date, field: string): Date {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new TypeError(`${field} deve ser uma data válida.`);
    }
    return new Date(value.getTime());
  }

  private static validateRole(role: UserRoles): UserRoles {
    if (!Object.values(UserRoles).includes(role)) {
      throw new TypeError("A função deve pertencer a UserRoles.");
    }
    return role;
  }

  private static validateStatus(status: UserStatus): UserStatus {
    if (!Object.values(UserStatus).includes(status)) {
      throw new TypeError("O status deve pertencer a UserStatus.");
    }
    return status;
  }

  private static validateCapabilities(capabilities: UserCapabilities[]): UserCapabilities[] {
    if (!Array.isArray(capabilities)) {
      throw new TypeError("As capacidades devem ser uma lista.");
    }
    const validated = Array.from(capabilities, capability => User.validateCapability(capability));
    if (new Set(validated).size !== validated.length) {
      throw new TypeError("As capacidades não podem estar duplicadas.");
    }
    return [...validated];
  }

  private static validateCapability(capability: UserCapabilities): UserCapabilities {
    if (!Object.values(UserCapabilities).includes(capability)) {
      throw new TypeError("A capacidade deve pertencer a UserCapabilities.");
    }
    return capability;
  }
}
