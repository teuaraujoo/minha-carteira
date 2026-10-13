import { AppError, ErrorCode } from "./app-error.js";
import { readOwnData, sanitizeDiagnostic, sanitizeText } from "./sanitize-diagnostic.js";

export interface ErrorResponse {
  status: number;
  message: string;
  code?: ErrorCode;
  details?: unknown;
  stack?: string;
  requestId?: string;
}

export interface ErrorResponseOptions {
  environment?: string | undefined;
  requestId?: string | undefined;
}

export function serializeError(error: unknown, options: ErrorResponseOptions = {}): ErrorResponse {
  const status = error instanceof AppError ? readOwnData(error, "status") : undefined;
  const message = error instanceof AppError ? readOwnData(error, "message") : undefined;
  const code = error instanceof AppError ? readOwnData(error, "code") : undefined;
  const isExpected = typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599 &&
    typeof message === "string" && message.trim().length > 0 && Object.values(ErrorCode).includes(code as ErrorCode);
  const body: ErrorResponse = {
    status: isExpected ? status : 500,
    message: isExpected ? sanitizeText(message) : "Erro interno do servidor.",
  };
  const environment = options.environment ?? process.env.NODE_ENV;
  if (environment !== "development" && environment !== "test") return body;

  body.code = isExpected ? code as ErrorCode : ErrorCode.INTERNAL_ERROR;
  if (isExpected) {
    const details = readOwnData(error as AppError, "details");
    if (details !== undefined) body.details = sanitizeDiagnostic(details);
  }
  const stack = error instanceof Error ? readOwnData(error, "stack") : undefined;
  if (typeof stack === "string") body.stack = sanitizeText(stack);
  if (options.requestId !== undefined) body.requestId = sanitizeText(options.requestId);
  return body;
}
