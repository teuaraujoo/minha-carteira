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
  inactivatedAt: Date;
}

export class User {
  userUsername: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: UserRoles;
  userPasswordHash: string;
  userCreatedAt: Date;
  userCapabilities: UserCapabilities[];
  userStatus: UserStatus;
  userUpdatedAt: Date;
  inactivatedAt: Date;

  constructor(props: UserProps) {
    this.userUsername = props.username;
    this.userName = props.name
    this.userEmail = props.email;
    this.userPhone = props.phone;
    this.userRole = props.role
    this.userPasswordHash = props.passwordHash,
    this.userCapabilities = props.capabilities;
    this.userStatus = props.status;
    this.userCreatedAt = props.createdAt;
    this.userUpdatedAt = props.updatedAt;
    this.inactivatedAt = props.inactivatedAt;
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

  isActive(): boolean {
    return this.userStatus === UserStatus.ACTIVE;
  }

  activate(): void {
    if (this.userStatus === UserStatus.ACTIVE) {
      return;
    }

    this.userStatus = UserStatus.ACTIVE;
    this.touch();
  }

  deactivate(): void {
    if (this.userStatus === UserStatus.INACTIVE) {
      return;
    }

    this.userStatus = UserStatus.INACTIVE;
    this.touch();
  }

  hasCapability(capability: UserCapabilities): boolean {
    User.validateCapability(capability);
    return this.userCapabilities.includes(capability);
  }

  grantCapability(capability: UserCapabilities): void {
    User.validateCapability(capability);

    if (this.hasCapability(capability)) {
      return;
    }

    this.userCapabilities.push(capability);
    this.touch();
  }

  revokeCapability(capability: UserCapabilities): void {
    User.validateCapability(capability);

    if (!this.hasCapability(capability)) {
      return;
    }

    this.userCapabilities = this.userCapabilities.filter(
      currentCapability => currentCapability !== capability,
    );
    this.touch();
  }

  private touch(): void {
    this.userUpdatedAt = new Date(
      Math.max(Date.now(), this.userUpdatedAt.getTime()),
    );
  }

  private static validateCapability(
    capability: UserCapabilities,
  ): UserCapabilities {
    if (!Object.values(UserCapabilities).includes(capability)) {
      throw new TypeError("A capacidade deve pertencer a UserCapabilities.");
    }

    return capability;
  }
}
