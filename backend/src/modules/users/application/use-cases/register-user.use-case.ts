import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { IdGenerator } from "../../../../shared/application/id-generator.js";
import type { PasswordHasher } from "../../../../shared/application/security/password-hasher.js";
import { UserIdentityConflictError } from "../../domain/errors/user-identity-conflict.error.js";
import { User } from "../../domain/entities/users.entity.js";
import type { IUsersRepository } from "../../domain/interfaces/users-repository.interface.js";
import type { RegisterUserInput, RegisterUserOutput } from "../dto/register-user.dto.js";
import { mapRegisterUserOutput } from "../mappers/register-user.mapper.js";

export class RegisterUserUseCase {
  constructor(
    private readonly usersRepository: IUsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly idGenerator: IdGenerator,
    private readonly clock: ClockProvider,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    if (await this.usersRepository.findByEmail(email)) {
      throw new UserIdentityConflictError("email");
    }
    if (await this.usersRepository.findByUsername(username)) {
      throw new UserIdentityConflictError("username");
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    if (typeof passwordHash !== "string" || !passwordHash.trim()) {
      throw new TypeError("O hash da senha é obrigatório.");
    }

    const user = User.create({
      id: this.idGenerator.generate(),
      username,
      name,
      email,
      phone: input.phone,
      passwordHash,
      createdAt: this.clock.now(),
    });

    await this.usersRepository.save(user);

    return mapRegisterUserOutput(user);
  }
}
