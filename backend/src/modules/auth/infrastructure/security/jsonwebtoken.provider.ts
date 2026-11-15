import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type {
  JwtProvider,
  OnboardingTokenSubject,
  TokenSubject,
  VerifiedOnboardingToken,
  VerifiedToken,
} from "../../application/contracts/auth.contracts.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import {
  ACCESS_TOKEN_TTL_MS,
  ONBOARDING_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from "../../domain/constants/auth.constants.js";

const JWT_ALGORITHM = "HS256" as const;
const DEFAULT_JWT_ISSUER = "minha-carteira-api";

export class JsonWebTokenProvider implements JwtProvider {
  private readonly issuer: string;

  constructor(
    private readonly secret: string | undefined = process.env.JWT_SECRET,
    issuer: string | undefined = process.env.JWT_ISSUER,
  ) {
    if (typeof secret !== "string" || !secret.trim()) {
      throw new Error("A variável de ambiente JWT_SECRET é obrigatória.");
    }
    this.issuer = typeof issuer === "string" && issuer.trim() ? issuer.trim() : DEFAULT_JWT_ISSUER;
  }

  async signAccessToken(subject: TokenSubject): Promise<string> {
    return this.sign(subject, "access", ACCESS_TOKEN_TTL_MS);
  }

  async signRefreshToken(subject: TokenSubject): Promise<string> {
    return this.sign(subject, "refresh", REFRESH_TOKEN_TTL_MS);
  }

  async signOnboardingToken(subject: OnboardingTokenSubject): Promise<string> {
    const email = subject.email.trim().toLowerCase();
    const challengeId = subject.challengeId.trim();
    if (!email || !challengeId) {
      throw new TypeError("O e-mail e o ID do desafio são obrigatórios para emitir o token de onboarding.");
    }
    return jwt.sign(
      { cid: challengeId, type: "onboarding" },
      this.secret as string,
      {
        algorithm: JWT_ALGORITHM,
        issuer: this.issuer,
        subject: email,
        jwtid: randomUUID(),
        expiresIn: Math.floor(ONBOARDING_TOKEN_TTL_MS / 1000),
      },
    );
  }

  async verifyAccessToken(token: string): Promise<VerifiedToken> {
    return this.verify(token, "access");
  }

  async verifyRefreshToken(token: string): Promise<VerifiedToken> {
    return this.verify(token, "refresh");
  }

  async verifyOnboardingToken(token: string): Promise<VerifiedOnboardingToken> {
    try {
      const payload = this.verifyRawPayload(token);
      return this.toVerifiedOnboardingToken(payload);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        status: 401,
        code: ErrorCode.UNAUTHORIZED,
        message: "Token inválido ou expirado.",
        cause: error,
      });
    }
  }

  private sign(subject: TokenSubject, type: VerifiedToken["type"], ttlMs: number): string {
    if (!subject.userId.trim() || !subject.sessionId.trim()) {
      throw new TypeError("O usuário e a sessão são obrigatórios para emitir um token.");
    }
    return jwt.sign(
      { sid: subject.sessionId, type },
      this.secret as string,
      {
        algorithm: JWT_ALGORITHM,
        issuer: this.issuer,
        subject: subject.userId,
        jwtid: randomUUID(),
        expiresIn: Math.floor(ttlMs / 1000),
      },
    );
  }

  private verify(token: string, expectedType: VerifiedToken["type"]): VerifiedToken {
    try {
      const payload = this.verifyRawPayload(token);
      return this.toVerifiedToken(payload, expectedType);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        status: 401,
        code: ErrorCode.UNAUTHORIZED,
        message: "Token inválido ou expirado.",
        cause: error,
      });
    }
  }

  private verifyRawPayload(token: string): JwtPayload {
    const payload = jwt.verify(token, this.secret as string, {
      algorithms: [JWT_ALGORITHM],
      issuer: this.issuer,
    });
    if (typeof payload === "string") throw new TypeError("Payload JWT inválido.");
    return payload;
  }

  private toVerifiedToken(payload: JwtPayload, expectedType: VerifiedToken["type"]): VerifiedToken {
    if (payload.type !== expectedType) {
      throw new TypeError("O tipo do token não corresponde à operação.");
    }
    if (typeof payload.sub !== "string" || !payload.sub.trim()
      || typeof payload.sid !== "string" || !payload.sid.trim()
      || typeof payload.jti !== "string" || !payload.jti.trim()
      || typeof payload.iss !== "string" || !payload.iss.trim()
      || typeof payload.iat !== "number" || !Number.isFinite(payload.iat)
      || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)
      || payload.exp <= payload.iat) {
      throw new TypeError("As claims do token são inválidas.");
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      tokenId: payload.jti,
      type: expectedType,
      issuer: payload.iss,
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
    };
  }

  private toVerifiedOnboardingToken(payload: JwtPayload): VerifiedOnboardingToken {
    if (payload.type !== "onboarding") {
      throw new TypeError("O tipo do token não corresponde à operação.");
    }
    if (typeof payload.sub !== "string" || !payload.sub.trim()
      || typeof payload.cid !== "string" || !payload.cid.trim()
      || typeof payload.jti !== "string" || !payload.jti.trim()
      || typeof payload.iss !== "string" || !payload.iss.trim()
      || typeof payload.iat !== "number" || !Number.isFinite(payload.iat)
      || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)
      || payload.exp <= payload.iat) {
      throw new TypeError("As claims do token são inválidas.");
    }

    return {
      email: payload.sub,
      challengeId: payload.cid,
      tokenId: payload.jti,
      type: "onboarding",
      issuer: payload.iss,
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
