import { createLogErrorDiagnostic } from "./shared/infrastructure/logging/log-sanitizer.js";
import { createCompositionRoot } from "./app/compositon-root.js";

try {
  const { app, logger } = createCompositionRoot();
  const PORT = process.env.PORT ?? 3000;

  const server = app.listen(PORT, () => {
    logger.info({
      event: "server.started",
      module: "server",
      message: `Servidor rodando na porta ${PORT}`,
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

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => void logger.close());
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    level: "fatal",
    event: "server.failed",
    module: "server",
    message: "Falha ao configurar o servidor",
    error: { ...createLogErrorDiagnostic(error), stack: "[Pilha indisponível]" },
  })}\n`);
  process.exitCode = 1;
}
