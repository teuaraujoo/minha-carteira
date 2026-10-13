import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { noopLogger, type AppLogger } from "../shared/application/logging/app-logger.js";
import { LogContext } from "../shared/infrastructure/logging/log-context.js";
import {
  bodyParserErrorHandler,
  createErrorHandler,
  JSON_BODY_LIMIT,
  notFoundHandler,
  terminateStartedResponse,
} from "../shared/presentation/http/error-middleware.js";
import { createRequestLoggingMiddleware } from "../shared/presentation/http/request-logging-middleware.js";

export interface CreateAppOptions {
  logger?: AppLogger;
}

export const createApp = (options: CreateAppOptions = {}) => {
  const app = express();
  const logContext = new LogContext(options.logger ?? noopLogger);

  app.use(createRequestLoggingMiddleware(logContext));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    }),
  );

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
};
