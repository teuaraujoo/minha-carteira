import type { UserCapabilities, UserRoles, UserStatus } from "../enums/users.enums.js";

export interface AuthUser {
  id: string;
  role: UserRoles;
  capabilities: UserCapabilities[];
  status: UserStatus;
}

export interface AuthUserCredentials {
  id: string;
  passwordHash: string;
  status: UserStatus;
}

export interface PasswordResetRecipient {
  id: string;
  email: string;
}
