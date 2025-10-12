import { createApp } from "./src/app.js";
import { createBitrixClient } from "./src/clients/bitrixClient.js";
import { createOpenAIClient } from "./src/clients/openaiClient.js";
import { loadConfig } from "./src/config/env.js";
import { createLegalAnalysisService } from "./src/services/legalAnalysisService.js";

const config = loadConfig();
const openAiClient = createOpenAIClient(config.openAiApiKey);
const bitrixClient = createBitrixClient({ baseUrl: config.bitrixUrl });
const legalAnalysisService = createLegalAnalysisService({
  openAiClient,
  chatAllowlist: config.allowedChatIds,
});

const app = createApp({
  config,
  legalAnalysisService,
  bitrixClient,
});

app.listen(config.port, () => {
  console.log(`EvaLegalAI Core listening on port ${config.port}`);
});
