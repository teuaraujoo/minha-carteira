import type { UserCapabilities, UserRoles, UserStatus } from "../../domain/enums/users.enums.js";

export interface AuthUserCredentials {
  id: string;
  passwordHash: string;
  status: UserStatus;
}

export interface AuthUser {
  id: string;
  role: UserRoles;
  capabilities: UserCapabilities[];
  status: UserStatus;
}

export interface UsersAuthGateway {
  findCredentialsByIdentifier(identifier: string): Promise<AuthUserCredentials | null>;
  findActiveUserById(userId: string): Promise<AuthUser | null>;
  changePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
