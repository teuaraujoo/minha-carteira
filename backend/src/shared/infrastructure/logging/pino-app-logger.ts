import pino, { type DestinationStream, type Logger as PinoLogger } from "pino";
import type { AppLogger, LogInput } from "../../application/logging/app-logger.js";
import { createLogErrorDiagnostic, sanitizeLogContext, sanitizeLogText } from "./log-sanitizer.js";

export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LoggerEnvironment {
  LOG_LEVEL?: string | undefined;
  NODE_ENV?: string | undefined;
}

export interface PinoAppLoggerOptions {
  level?: string;
  environment?: LoggerEnvironment;
  destination?: DestinationStream;
  pretty?: boolean;
}

export interface ResolvedLoggerConfiguration {
  level: LogLevel;
  pretty: boolean;
}

export function resolveLoggerConfiguration(options: PinoAppLoggerOptions = {}): ResolvedLoggerConfiguration {
  const environment = options.environment ?? process.env;
  const selectedLevel = options.level ?? environment.LOG_LEVEL ?? (environment.NODE_ENV === "development" ? "debug" : "info");
  if (!LOG_LEVELS.includes(selectedLevel as LogLevel)) {
    throw new Error(`LOG_LEVEL inválido: ${selectedLevel}`);
  }
  return {
    level: selectedLevel as LogLevel,
    pretty: environment.NODE_ENV === "development" && options.destination === undefined && options.pretty !== false,
  };
}

function safeOnError(destination: DestinationStream): void {
  const eventDestination = destination as DestinationStream & { on?: (event: string, listener: (error: unknown) => void) => void };
  try {
    eventDestination.on?.("error", () => undefined);
  } catch {
    // Logging failures must not replace the application flow.
  }
}

export class PinoAppLogger implements AppLogger {
  private closePromise: Promise<void> | undefined;

  constructor(
    private readonly pinoLogger: PinoLogger,
    private readonly ownedDestination?: DestinationStream,
  ) {}

  debug(input: LogInput): void { this.emit("debug", input); }
  info(input: LogInput): void { this.emit("info", input); }
  warn(input: LogInput): void { this.emit("warn", input); }
  error(input: LogInput): void { this.emit("error", input); }
  fatal(input: LogInput): void { this.emit("fatal", input); }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closePromise = Promise.resolve().then(async () => {
      try {
        this.pinoLogger.flush();
      } catch {
        return;
      }
      const destination = this.ownedDestination as DestinationStream & {
        closed?: boolean;
        destroyed?: boolean;
        end?: (callback?: () => void) => void;
        once?: (event: string, listener: () => void) => void;
      };
      if (!destination?.end) return;
      if (destination.closed || destination.destroyed) return;
      await new Promise<void>((resolve) => {
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          resolve();
        };
        try {
          destination.once?.("close", done);
          destination.once?.("finish", done);
          destination.once?.("error", done);
          destination.end?.(done);
          if (destination.closed || destination.destroyed) done();
        } catch {
          done();
        }
      });
    });
    return this.closePromise;
  }

  private emit(level: LogLevel, input: LogInput): void {
    try {
      const event = readOwnValue(input, "event");
      const module = readOwnValue(input, "module");
      const message = readOwnValue(input, "message");
      if (typeof event !== "string" || typeof module !== "string" || typeof message !== "string") return;
      const record: Record<string, unknown> = {
        event: sanitizeLogText(event),
        module: sanitizeLogText(module),
      };
      const requestId = readOwnValue(input, "requestId");
      if (typeof requestId === "string") record.requestId = sanitizeLogText(requestId);
      const context = sanitizeLogContext(readOwnValue(input, "context"));
      if (context !== undefined) record.context = context;
      const http = readOwnValue(input, "http");
      if (typeof http === "object" && http !== null) {
        const method = readOwnValue(http, "method");
        const route = readOwnValue(http, "route");
        const statusCode = readOwnValue(http, "statusCode");
        if (typeof method === "string" && typeof route === "string" && typeof statusCode === "number") {
        record.http = {
            method: sanitizeLogText(method),
            route: sanitizeLogText(route),
            statusCode,
        };
      }
      }
      const error = readOwnValue(input, "error");
      if (error !== undefined) record.error = createLogErrorDiagnostic(error);
      this.pinoLogger[level](record, sanitizeLogText(message));
    } catch {
      // The logger is observational and must never change business behavior.
    }
  }
}

function readOwnValue(value: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

export function createPinoAppLogger(options: PinoAppLoggerOptions = {}): AppLogger {
  const configuration = resolveLoggerConfiguration(options);
  let ownedDestination: DestinationStream | undefined;
  let destination = options.destination;

  if (configuration.pretty) {
    ownedDestination = pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        messageKey: "message",
        singleLine: true,
        timestampKey: "timestamp",
      },
    });
    destination = ownedDestination;
  }

  const logger = pino({
    base: null,
    level: configuration.level,
    messageKey: "message",
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({ level: label }),
    },
  }, destination);

  safeOnError(destination ?? process.stdout);
  return new PinoAppLogger(logger, ownedDestination);
}
