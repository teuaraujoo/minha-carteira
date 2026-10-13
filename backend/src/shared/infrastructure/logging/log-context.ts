import { AsyncLocalStorage } from "node:async_hooks";
import type { AppLogger, LogInput } from "../../application/logging/app-logger.js";

interface RequestLogStore {
  active: boolean;
  logger: AppLogger;
}

function bindRequestId(baseLogger: AppLogger, requestId: string): AppLogger {
  const bind = (method: "debug" | "info" | "warn" | "error" | "fatal") => (input: LogInput): void => {
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      descriptors.requestId = { configurable: true, enumerable: true, value: requestId, writable: false };
      const boundInput = Object.defineProperties(Object.create(null) as LogInput, descriptors);
      baseLogger[method](boundInput);
    } catch {
      // Invalid log input must not replace the application flow.
    }
  };
  return {
    debug: bind("debug"),
    info: bind("info"),
    warn: bind("warn"),
    error: bind("error"),
    fatal: bind("fatal"),
    close: async () => undefined,
  };
}

export class LogContext {
  private readonly storage = new AsyncLocalStorage<RequestLogStore>();

  constructor(private readonly baseLogger: AppLogger) {}

  logger(): AppLogger {
    const store = this.storage.getStore();
    return store?.active ? store.logger : this.baseLogger;
  }

  runWithRequest<T>(requestId: string, callback: (deactivate: () => void) => T): T {
    const store: RequestLogStore = {
      active: true,
      logger: bindRequestId(this.baseLogger, requestId),
    };
    return this.storage.run(store, () => callback(() => {
      store.active = false;
    }));
  }
}
