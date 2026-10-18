import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import { UserNotFoundError } from "../../domain/errors/user-not-found.error.js";
import type { IUsersRepository } from "../../domain/interfaces/users-repository.interface.js";
import type { AuthUser, AuthUserCredentials, UsersAuthGateway } from "../../application/contracts/users-auth.gateway.js";

export class UsersAuthGatewayAdapter implements UsersAuthGateway {
  constructor(
    private readonly usersRepository: IUsersRepository,
    private readonly clock: ClockProvider,
  ) {}

  async findCredentialsByIdentifier(identifier: string): Promise<AuthUserCredentials | null> {
    const user = await this.usersRepository.findByIdentifier(identifier);
    if (!user) return null;
    return { id: user.id, passwordHash: user.passwordHash, status: user.status };
  }

  async findActiveUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.usersRepository.findActiveById(userId);
    if (!user) return null;
    return {
      id: user.id,
      role: user.role,
      capabilities: user.capabilities,
      status: user.status,
    };
  }

  async changePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new UserNotFoundError();
    user.changePasswordHash(passwordHash, this.clock.now());
    await this.usersRepository.save(user);
  }
}
