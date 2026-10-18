import type { ClockProvider } from "../../../../shared/application/clock-provider.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import type { UsersAuthGateway } from "../../../users/index.js";
import type {
  JwtProvider,
  RefreshTokenRepository,
  TokenHasher,
} from "../contracts/auth.contracts.js";

export interface RefreshSessionInput {
  refreshToken: string;
}

export interface RefreshSessionOutput {
  accessToken: string;
}

export interface RefreshSessionDependencies {
  jwtProvider: JwtProvider;
  refreshTokenRepository: RefreshTokenRepository;
  usersAuthGateway: UsersAuthGateway;
  tokenHasher: TokenHasher;
  clock: ClockProvider;
}

export class RefreshSessionUseCase {
  constructor(private readonly dependencies: RefreshSessionDependencies) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    if (typeof input?.refreshToken !== "string" || !input.refreshToken.trim()) {
      throw unauthorized();
    }

    const { jwtProvider, refreshTokenRepository, usersAuthGateway, tokenHasher, clock } = this.dependencies;
    const verified = await jwtProvider.verifyRefreshToken(input.refreshToken);
    if (verified.type !== "refresh") throw unauthorized();

    const now = clock.now();
    const session = await refreshTokenRepository.findActiveById(verified.sessionId, now);
    if (!session || session.userId !== verified.userId
      || !await tokenHasher.matches(input.refreshToken, session.tokenHash)) {
      throw unauthorized();
    }

    const user = await usersAuthGateway.findActiveUserById(verified.userId);
    if (!user || user.status !== "ACTIVE") throw unauthorized();

    const accessToken = await jwtProvider.signAccessToken({
      userId: verified.userId,
      sessionId: verified.sessionId,
    });
    await refreshTokenRepository.registerUse(session.id, now);

    return { accessToken };
  }
}

function unauthorized(): AppError {
  return new AppError({
    status: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: "Token inválido ou expirado.",
  });
}
