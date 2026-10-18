import type { UsersRegistrationGateway } from "../../application/contracts/users-registration.gateway.js";
import type { RegisterUserInput, RegisterUserOutput } from "../../application/dto/register-user.dto.js";
import type { RegisterUserUseCase } from "../../application/use-cases/register-user.use-case.js";

export class UsersRegistrationGatewayAdapter implements UsersRegistrationGateway {
  constructor(private readonly registerUserUseCase: Pick<RegisterUserUseCase, "execute">) {}

  registerUser(input: RegisterUserInput): Promise<RegisterUserOutput> {
    return this.registerUserUseCase.execute(input);
  }
}
