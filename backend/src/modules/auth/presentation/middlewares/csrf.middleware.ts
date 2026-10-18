import { randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { AUTH_COOKIE_NAMES } from "../security/auth-cookies.js";

export function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createOriginValidationMiddleware(allowedOrigins: ReadonlySet<string>): RequestHandler {
  return (request, _response, next) => {
    const origin = request.get("origin");
    if (!origin || !allowedOrigins.has(origin)) {
      next(forbidden("A origem da requisição não é permitida."));
      return;
    }
    next();
  };
}

export function createCsrfValidationMiddleware(allowedOrigins: ReadonlySet<string>): RequestHandler {
  return (request, _response, next) => {
    const origin = request.get("origin");
    const cookieToken = request.cookies?.[AUTH_COOKIE_NAMES.csrf];
    const headerToken = request.get("x-csrf-token");

    if (!origin || !allowedOrigins.has(origin)) {
      next(forbidden("A origem da requisição não é permitida."));
      return;
    }

    if (!equalTokens(cookieToken, headerToken)) {
      next(forbidden("A validação CSRF da requisição falhou."));
      return;
    }

    next();
  };
}

function equalTokens(cookieToken: unknown, headerToken: string | undefined): boolean {
  if (typeof cookieToken !== "string" || !headerToken) return false;
  const cookie = Buffer.from(cookieToken, "utf8");
  const header = Buffer.from(headerToken, "utf8");
  return cookie.length === header.length && timingSafeEqual(cookie, header);
}

function forbidden(message: string): AppError {
  return new AppError({ status: 403, code: ErrorCode.FORBIDDEN, message });
}
