import { createCompositionRoot } from "./app/compositon-root.js";
import { startServer } from "./app/start-server.js";
import { createPinoAppLogger } from "./shared/infrastructure/logging/pino-app-logger.js";

try {
  const { app, logger } = createCompositionRoot();
  const port = process.env.PORT ?? 3000;
  const { shutdown } = startServer(app, logger, port);

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
} catch (error) {
  const fallbackLogger = createPinoAppLogger({
    level: "fatal",
    environment: { NODE_ENV: "production" },
    destination: process.stderr,
  });
  fallbackLogger.fatal({
    event: "server.failed",
    module: "server",
    message: "Falha ao configurar o servidor",
    error,
  });
  process.exitCode = 1;
  void fallbackLogger.close();
}
