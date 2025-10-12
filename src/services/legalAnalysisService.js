import axios from "axios";

export const DEFAULT_OPENAI_MODEL = "gpt-4o";
export const EMPTY_AI_RESPONSE_FALLBACK = "Пустой ответ от AI.";
export const SYSTEM_PROMPT =
  "Ты — юрист-аналитик компании Эверест. Проверяй договоры, выделяй ключевые условия, делай таблицу рисков (утверждённый шаблон), готовь претензии по 115-ФЗ и 375-П.";
export const FILE_NOTICE_TEXT = "Файл договора во вложении.";

/**
 * Constructs the OpenAI messages payload for the legal analysis task.
 * @param {{ task: string | undefined, dealId: string | undefined, base64File: string }} params
 */
export function buildLegalAnalysisMessages({ task, dealId, base64File }) {
  const safeTask = task ?? "не указана";
  const safeDealId = dealId ?? "не указана";

  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `Задача: ${safeTask}. Сделка: ${safeDealId}. Верни: 1) Саммари; 2) Таблицу рисков; 3) Черновик претензии.`,
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: FILE_NOTICE_TEXT,
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_file",
          mime_type: "application/pdf",
          data: base64File,
        },
      ],
    },
  ];
}

function isChatAllowed(chatId, allowlist) {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }
  return allowlist.map(String).includes(String(chatId));
}

/**
 * Factory for the legal analysis service.
 * @param {{
 *   openAiClient: import("openai").OpenAI,
 *   chatAllowlist?: string[],
 *   httpClient?: typeof axios,
 * }} options
 */
export function createLegalAnalysisService({
  openAiClient,
  chatAllowlist = [],
  httpClient = axios,
} = {}) {
  if (!openAiClient) {
    throw new Error("openAiClient is required");
  }

  return {
    /**
     * Executes the legal analysis workflow and returns the AI response.
     * @param {{ chatId: string|number, dealId: string, fileUrl: string, task: string }} payload
     */
    async processLegalRequest({ chatId, dealId, fileUrl, task }) {
      if (!chatId) {
        throw new Error("chatId is required");
      }
      if (!fileUrl) {
        throw new Error("fileUrl is required");
      }
      if (!isChatAllowed(chatId, chatAllowlist)) {
        const error = new Error("chat not allowed");
        error.statusCode = 403;
        throw error;
      }

      const { data: fileBuffer } = await httpClient.get(fileUrl, {
        responseType: "arraybuffer",
      });
      const base64File = Buffer.from(fileBuffer).toString("base64");
      const messages = buildLegalAnalysisMessages({ task, dealId, base64File });

      const aiResponse = await openAiClient.chat.completions.create({
        model: DEFAULT_OPENAI_MODEL,
        messages,
      });

      const answer =
        aiResponse?.choices?.[0]?.message?.content?.trim() ||
        EMPTY_AI_RESPONSE_FALLBACK;
      return answer;
    },
  };
}
