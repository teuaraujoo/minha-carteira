import type { Server } from "node:http";
import type { Express } from "express";
import type { AppLogger } from "../shared/application/logging/app-logger.js";

export interface StartedServer {
  server: Server;
  shutdown(): Promise<void>;
}

export function startServer(app: Express, logger: AppLogger, port: string | number): StartedServer {
  const server = app.listen(port, () => {
    logger.info({
      event: "server.started",
      module: "server",
      message: "Servidor iniciado",
      context: { operation: "listen" },
    });
  });

  server.on("error", (error) => {
    logger.fatal({
      event: "server.failed",
      module: "server",
      message: "Falha ao iniciar o servidor",
      error,
    });
    process.exitCode = 1;
    void logger.close();
  });

  let shutdownPromise: Promise<void> | undefined;
  return {
    server,
    shutdown() {
      if (shutdownPromise) return shutdownPromise;
      shutdownPromise = new Promise<void>((resolve) => {
        server.close(() => {
          void logger.close().finally(resolve);
        });
      });
      return shutdownPromise;
    },
  };
}
