import { Router } from "express";

/**
 * Creates routes related to legal analysis workflows.
 * @param {{
 *   legalAnalysisService: import("../services/legalAnalysisService.js").createLegalAnalysisService,
 *   bitrixClient: ReturnType<import("../clients/bitrixClient.js").createBitrixClient>,
 * }} dependencies
 */
export function createLegalRouter({ legalAnalysisService, bitrixClient }) {
  if (!legalAnalysisService) {
    throw new Error("legalAnalysisService is required");
  }
  if (!bitrixClient) {
    throw new Error("bitrixClient is required");
  }

  const router = Router();

  router.post("/", async (req, res) => {
    const { chatId, dealId, fileUrl, task } = req.body || {};

    try {
      const answer = await legalAnalysisService.processLegalRequest({
        chatId,
        dealId,
        fileUrl,
        task,
      });
      await bitrixClient.sendMessage(chatId, answer);
      res.json({ ok: true });
    } catch (error) {
      const errorMessage = error?.message || "Unknown error";
      if (chatId) {
        try {
          await bitrixClient.sendMessage(chatId, `Ошибка анализа: ${errorMessage}`);
        } catch (notificationError) {
          // We intentionally swallow notification failures to avoid masking the main error response.
        }
      }
      res
        .status(error?.statusCode || 500)
        .json({ error: errorMessage });
    }
  });

  router.get("/", (req, res) => {
    res.status(405).send(
      "Method Not Allowed. This endpoint only accepts POST requests with a JSON body containing chatId, dealId, fileUrl and task."
    );
  });

  return router;
}
