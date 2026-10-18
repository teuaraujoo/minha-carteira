import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import type { RefreshTokenRepository } from "../contracts/auth.contracts.js";
import { RefreshTokenRevokeReason } from "../../domain/enums/auth.enums.js";

export interface LogoutSessionInput {
  sessionId: string | null;
}

export interface LogoutSessionDependencies {
  refreshTokenRepository: RefreshTokenRepository;
  clock: ClockProvider;
}

export class LogoutSessionUseCase {
  constructor(private readonly dependencies: LogoutSessionDependencies) {}

  async execute(input: LogoutSessionInput): Promise<void> {
    const sessionId = input?.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim()) return;

    await this.dependencies.refreshTokenRepository.revoke(
      sessionId,
      this.dependencies.clock.now(),
      RefreshTokenRevokeReason.LOGOUT,
    );
  }
}
