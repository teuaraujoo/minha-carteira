import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import type { AppLogger, LogHttp } from "../../application/logging/app-logger.js";
import type { LogContext } from "../../infrastructure/logging/log-context.js";
import { sanitizeLogText } from "../../infrastructure/logging/log-sanitizer.js";

type RequestWithRoute = Request & { route?: { path?: unknown } };

const SAFE_ROUTE_PREFIX_SEGMENTS = new Set([
  "api",
  "v1",
  "auth",
  "accounts",
  "categories",
  "transactions",
  "recurring-transactions",
  "dashboard",
]);

function normalizeRoutePrefix(baseUrl: string): string {
  return baseUrl
    .split("/")
    .filter(Boolean)
    .map((segment) => SAFE_ROUTE_PREFIX_SEGMENTS.has(segment) ? segment : ":segment")
    .join("/");
}

export function resolveRoutePattern(request: Request): string {
  const path = (request as RequestWithRoute).route?.path;
  const routePath = typeof path === "string"
    ? path
    : Array.isArray(path) && typeof path[0] === "string" ? path[0] : undefined;
  if (routePath === undefined) return "unmatched";
  const prefix = typeof request.baseUrl === "string" ? normalizeRoutePrefix(request.baseUrl) : "";
  const normalizedPrefix = prefix ? `/${prefix}` : "";
  return sanitizeLogText(`${normalizedPrefix}${routePath}` || "/");
}

export function createHttpLog(request: Request, response: Response): LogHttp {
  return {
    method: typeof request.method === "string" ? sanitizeLogText(request.method) : "UNKNOWN",
    route: resolveRoutePattern(request),
    statusCode: Number.isInteger(response.statusCode) ? response.statusCode : 500,
  };
}

function logCompleted(logger: AppLogger, http: LogHttp): void {
  const input = {
    event: "http.request.completed" as const,
    module: "http" as const,
    message: "Requisição concluída",
    http,
  };
  if (http.statusCode >= 500) logger.error(input);
  else if (http.statusCode >= 400) logger.warn(input);
  else logger.info(input);
}

export function createRequestLoggingMiddleware(logContext: LogContext): RequestHandler {
  return (request, response, next) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;

    logContext.runWithRequest(requestId, (deactivate) => {
      const requestLogger = logContext.logger();
      let finalized = false;

      response.once("finish", () => {
        if (finalized) return;
        finalized = true;
        logCompleted(requestLogger, createHttpLog(request, response));
        deactivate();
      });
      response.once("close", () => {
        if (finalized) return;
        finalized = true;
        requestLogger.warn({
          event: "http.request.aborted",
          module: "http",
          message: "Requisição interrompida",
          http: createHttpLog(request, response),
        });
        deactivate();
      });

      next();
    });
  };
}
