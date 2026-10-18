import type { AuthUser, AuthUserCredentials, PasswordResetRecipient } from "../../domain/interfaces/users.interfaces.js";
import type { RegisterUserInput, RegisterUserOutput } from "../dto/register-user.dto.js";

export interface UsersRegistrationGateway {
  registerUser(input: RegisterUserInput): Promise<RegisterUserOutput>;
}

export interface UsersAuthGateway {
  findCredentialsByIdentifier(identifier: string): Promise<AuthUserCredentials | null>;
  findActiveUserById(userId: string): Promise<AuthUser | null>;
  findActivePasswordResetRecipient(email: string): Promise<PasswordResetRecipient | null>;
  findActivePasswordResetRecipientById(userId: string): Promise<PasswordResetRecipient | null>;
  changePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
