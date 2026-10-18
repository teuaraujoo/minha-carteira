import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { RefreshTokensGateway } from "../../application/contracts/auth.contracts.js";
import type { RefreshTokenRepository } from "../../application/contracts/auth.contracts.js";
import { RefreshTokenRevokeReason } from "../../domain/enums/auth.enums.js";

export class RefreshTokensGatewayAdapter implements RefreshTokensGateway {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly clock: ClockProvider,
  ) {}

  async revokeAllFromUser(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllFromUser(
      userId,
      this.clock.now(),
      RefreshTokenRevokeReason.USER_DEACTIVATED,
    );
  }
}
