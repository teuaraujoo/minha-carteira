import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { AppLogger } from "../shared/application/logging/app-logger.js";
import { LogContext } from "../shared/infrastructure/logging/log-context.js";
import {
  bodyParserErrorHandler,
  createErrorHandler,
  JSON_BODY_LIMIT,
  notFoundHandler,
  terminateStartedResponse,
} from "../shared/presentation/middlewares/error-middleware.js";
import { createRequestLoggingMiddleware } from "../shared/presentation/middlewares/request-logging-middleware.js";
import type { Router } from "express";

export interface CreateAppOptions {
  logger: AppLogger;
  authRouter: Router;
  usersRouter: Router;
  allowedOrigins: string[];
}

export function createApp(options: CreateAppOptions) {
  const app = express();
  const logContext = new LogContext(options.logger);
  const allowedOrigins = new Set(options.allowedOrigins);

  app.use(createRequestLoggingMiddleware(logContext));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
      credentials: true,
    }),
  );

  app.use("/api/v1/auth", options.authRouter);
  app.use("/api/v1/users", options.usersRouter);

  app.get("/", (_request, response) => {
    response.status(200).send("Hello, World!");
  });

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use(bodyParserErrorHandler);
  app.use(notFoundHandler);
  app.use(createErrorHandler(logContext));
  app.use(terminateStartedResponse);

  return app;
}
