import type { UserCapabilities, UserRoles, UserStatus } from "../../domain/enums/users.enums.js";

export interface RegisterUserInput {
  username: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterUserOutput {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRoles;
  capabilities: UserCapabilities[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
}
