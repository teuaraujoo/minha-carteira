import type { AccountReactivationRecipient, AuthUser, AuthUserCredentials, PasswordResetRecipient } from "../../domain/interfaces/users.interfaces.js";
import type { RegisterUserInput, RegisterUserOutput } from "../dto/register-user.dto.js";

export interface UsersRegistrationGateway {
  registerUser(input: RegisterUserInput): Promise<RegisterUserOutput>;
}

export interface UsersAuthGateway {
  findCredentialsByIdentifier(identifier: string): Promise<AuthUserCredentials | null>;
  findActiveUserById(userId: string): Promise<AuthUser | null>;
  findActivePasswordResetRecipient(email: string): Promise<PasswordResetRecipient | null>;
  findActivePasswordResetRecipientById(userId: string): Promise<PasswordResetRecipient | null>;
  findInactiveAccountReactivationRecipient(email: string): Promise<AccountReactivationRecipient | null>;
  reactivateUserById(userId: string): Promise<boolean>;
  changePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
