import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import {
  bodyParserErrorHandler,
  errorHandler,
  JSON_BODY_LIMIT,
  notFoundHandler,
} from "../shared/presentation/http/error-middleware.js";

export const createApp = () => {
  const app = express();

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
  app.use(errorHandler);

  return app;
};
