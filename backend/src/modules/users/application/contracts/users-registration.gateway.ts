import type { RegisterUserInput, RegisterUserOutput } from "../dto/register-user.dto.js";

export interface UsersRegistrationGateway {
  registerUser(input: RegisterUserInput): Promise<RegisterUserOutput>;
}
