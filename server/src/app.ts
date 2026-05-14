import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { requestContext } from "./middleware/request-context";
import { requestLogger } from "./middleware/request-logger";
import { apiRouter } from "./routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use(requestContext);
  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
