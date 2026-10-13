export const LOG_MODULES = [
  "http",
  "server",
  "auth",
  "accounts",
  "categories",
  "transactions",
  "recurring-transactions",
  "dashboard",
] as const;

export type LogModule = (typeof LOG_MODULES)[number];

export type LogEvent =
  | "http.request.completed"
  | "http.request.aborted"
  | "http.request.failed"
  | "server.started"
  | "server.failed";

export interface ApprovedLogContext {
  operation?: string;
  count?: number;
  userId?: string;
  accountId?: string;
  categoryId?: string;
  transactionId?: string;
  recurringTransactionId?: string;
}

export interface LogHttp {
  method: string;
  route: string;
  statusCode: number;
}

export interface LogInput {
  event: LogEvent;
  module: LogModule;
  message: string;
  requestId?: string;
  context?: ApprovedLogContext;
  http?: LogHttp;
  error?: unknown;
}

export interface AppLogger {
  debug(input: LogInput): void;
  info(input: LogInput): void;
  warn(input: LogInput): void;
  error(input: LogInput): void;
  fatal(input: LogInput): void;
  close(): Promise<void>;
}

const ignoreLog = (_input: LogInput): void => undefined;

export const noopLogger: AppLogger = {
  debug: ignoreLog,
  info: ignoreLog,
  warn: ignoreLog,
  error: ignoreLog,
  fatal: ignoreLog,
  close: async () => undefined,
};
