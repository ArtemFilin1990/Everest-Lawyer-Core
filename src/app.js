import express from "express";
import helmet from "helmet";
import bodyParser from "body-parser";

import { createLegalRouter } from "./routes/legalRoutes.js";

/**
 * Builds the Express application with all middlewares and routes registered.
 * @param {{
 *   config: {
 *     requestBodyLimit: string,
 *   },
 *   legalAnalysisService: ReturnType<import("./services/legalAnalysisService.js").createLegalAnalysisService>,
 *   bitrixClient: ReturnType<import("./clients/bitrixClient.js").createBitrixClient>,
 * }} dependencies
 */
export function createApp({ config, legalAnalysisService, bitrixClient }) {
  if (!config) {
    throw new Error("config is required to create the application");
  }

  const app = express();
  app.use(helmet());
  app.use(bodyParser.json({ limit: config.requestBodyLimit }));

  app.get("/health", (req, res) => {
    res.status(200).send("ok");
  });

  app.get("/", (req, res) => {
    res.status(200).send("EvaLegalAI Core server is running");
  });

  const legalRouter = createLegalRouter({ legalAnalysisService, bitrixClient });
  app.use("/legal", legalRouter);

  return app;
}
