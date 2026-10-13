import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, ErrorCode } from "./app-error.js";
import { serializeError } from "./error-response.js";
import { readDataProperty, readOwnData } from "./sanitize-diagnostic.js";

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

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  const requestId = readOwnData(response.locals, "requestId");
  const body = serializeError(error, { requestId: typeof requestId === "string" ? requestId : undefined });
  response.status(body.status).json(body);
};
