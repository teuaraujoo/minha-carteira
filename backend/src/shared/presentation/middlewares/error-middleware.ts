import type { ErrorRequestHandler, RequestHandler } from "express";
import { noopLogger } from "../../application/logging/app-logger.js";
import { LogContext } from "../../infrastructure/logging/log-context.js";
import { AppError, ErrorCode } from "../http/app-error.js";
import { serializeError } from "../http/error-response.js";
import { createHttpLog } from "./request-logging-middleware.js";
import { readDataProperty, readOwnData } from "../http/sanitize-diagnostic.js";

export const JSON_BODY_LIMIT = "100kb";

export const bodyParserErrorHandler: ErrorRequestHandler = (error: unknown, _request, _response, next) => {
  if (error instanceof Error) {
    const type = readOwnData(error, "type");
    const status = readDataProperty(error, "status");
    if (error instanceof SyntaxError && type === "entity.parse.failed" && status === 400) {
      next(new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "JSON inválido.", cause: error }));
      return;
    }
    if (type === "entity.too.large" && status === 413) {
      next(new AppError({ status: 413, code: ErrorCode.VALIDATION_ERROR, message: "Corpo da requisição excede o limite permitido.", cause: error }));
      return;
    }
  }
  next(error);
};

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError({ status: 404, code: ErrorCode.NOT_FOUND, message: "Recurso não encontrado." }));
};

const loggedResponses = new WeakSet<object>();

export function createErrorHandler(logContext: LogContext): ErrorRequestHandler {
  return (error: unknown, request, response, next) => {
    const body = serializeError(error);
    if (!loggedResponses.has(response)) {
      loggedResponses.add(response);
      const input = {
        event: "http.request.failed" as const,
        module: "http" as const,
        message: "Falha no processamento da requisição",
        http: { ...createHttpLog(request, response), statusCode: body.status },
        error,
      };
      if (body.status >= 500) logContext.logger().error(input);
      else logContext.logger().warn(input);
    }

    if (response.headersSent) {
      next(error);
      return;
    }
    response.status(body.status).json(body);
  };
}

export const terminateStartedResponse: ErrorRequestHandler = (error, _request, response, next) => {
  if (!response.headersSent) {
    next(error);
    return;
  }
  response.destroy();
};

export const errorHandler = createErrorHandler(new LogContext(noopLogger));
