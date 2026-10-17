export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface AppErrorOptions {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(options: AppErrorOptions) {
    if (!Number.isInteger(options.status) || options.status < 400 || options.status > 599) {
      throw new RangeError("O status de AppError deve ser um inteiro entre 400 e 599.");
    }
    if (!Object.values(ErrorCode).includes(options.code)) {
      throw new TypeError("O código de AppError deve pertencer a ErrorCode.");
    }
    if (typeof options.message !== "string" || !options.message.trim()) {
      throw new TypeError("A mensagem de AppError deve ser pública e não pode estar vazia.");
    }

    super(options.message, { cause: options.cause });
    this.name = "AppError";
    // Snapshot the native lazy stack while this error is still owned by its constructor.
    // Serialization can then inspect a data descriptor without calling application getters.
    Object.defineProperty(this, "stack", { value: this.stack, writable: true, configurable: true });
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}
