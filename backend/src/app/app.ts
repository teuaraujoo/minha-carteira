import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

export const createApp = () => {
  const app = express();

  app.use(express.json());
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

  return app;
};
