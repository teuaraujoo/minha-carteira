import { createPinoAppLogger } from "../shared/infrastructure/logging/pino-app-logger.js";
import { createApp } from "./app.js";

export function createCompositionRoot() {
  const logger = createPinoAppLogger();
  const app = createApp({ logger });

  return { app, logger };
}
