import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type {
  JwtProvider,
  TokenSubject,
  VerifiedToken,
} from "../../application/contracts/auth.contracts.js";
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from "../../domain/entities/auth.entities.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";

const JWT_ALGORITHM = "HS256" as const;

export class JsonWebTokenProvider implements JwtProvider {
  constructor(private readonly secret: string | undefined = process.env.JWT_SECRET) {
    if (typeof secret !== "string" || !secret.trim()) {
      throw new Error("A variável de ambiente JWT_SECRET é obrigatória.");
    }
  }

  async signAccessToken(subject: TokenSubject): Promise<string> {
    return this.sign(subject, "access", ACCESS_TOKEN_TTL_MS);
  }

  async signRefreshToken(subject: TokenSubject): Promise<string> {
    return this.sign(subject, "refresh", REFRESH_TOKEN_TTL_MS);
  }

  async verifyAccessToken(token: string): Promise<VerifiedToken> {
    return this.verify(token, "access");
  }

  async verifyRefreshToken(token: string): Promise<VerifiedToken> {
    return this.verify(token, "refresh");
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
        subject: subject.userId,
        jwtid: randomUUID(),
        expiresIn: Math.floor(ttlMs / 1000),
      },
    );
  }

  private verify(token: string, expectedType: VerifiedToken["type"]): VerifiedToken {
    try {
      const payload = jwt.verify(token, this.secret as string, {
        algorithms: [JWT_ALGORITHM],
      });
      if (typeof payload === "string") throw new TypeError("Payload JWT inválido.");
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

  private toVerifiedToken(payload: JwtPayload, expectedType: VerifiedToken["type"]): VerifiedToken {
    if (payload.type !== expectedType) {
      throw new TypeError("O tipo do token não corresponde à operação.");
    }
    if (typeof payload.sub !== "string" || !payload.sub.trim()
      || typeof payload.sid !== "string" || !payload.sid.trim()
      || typeof payload.jti !== "string" || !payload.jti.trim()
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
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
