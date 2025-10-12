import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import OpenAI from "openai";

dotenv.config();

// Initialize Express app
const app = express();
app.use(helmet());
app.use(bodyParser.json({ limit: "20mb" }));

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BITRIX_URL = process.env.BITRIX_URL;
// Comma separated list of allowed chat IDs, trimmed and filtered
const CHAT_ALLOWLIST = (process.env.ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Initialise OpenAI client
const ai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Helper function to send a message to a Bitrix24 chat
 * @param {string|number} chatId - Chat ID
 * @param {string} message - Message content
 */
async function sendToBitrix(chatId, message) {
  if (!BITRIX_URL) {
    throw new Error("BITRIX_URL is not defined in environment variables");
  }
  await axios.post(`${BITRIX_URL}im.message.add`, {
    DIALOG_ID: chatId,
    MESSAGE: message,
  });
}

// Simple healthcheck endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

/**
 * Main endpoint: handles contract analysis and claim generation.
 * Expects JSON body with chatId, dealId, fileUrl and task fields.
 */
app.post("/legal", async (req, res) => {
  const { chatId, dealId, fileUrl, task } = req.body || {};
  try {
    // Validate allowlist
    if (
      CHAT_ALLOWLIST.length > 0 &&
      !CHAT_ALLOWLIST.includes(String(chatId))
    ) {
      return res.status(403).json({ error: "chat not allowed" });
    }
    // Download file from provided URL (e.g., Bitrix disk URL)
    const { data: fileBuffer } = await axios.get(fileUrl, {
      responseType: "arraybuffer",
    });
    const base64File = Buffer.from(fileBuffer).toString("base64");

    // Compose messages for OpenAI Chat Completion
    const messages = [
      {
        role: "system",
        content:
          "Ты — юрист-аналитик компании Эверест. Проверяй договоры, выделяй ключевые условия, делай таблицу рисков (утверждённый шаблон), готовь претензии по 115-ФЗ и 375-П.",
      },
      {
        role: "user",
        content: `Задача: ${task}. Сделка: ${dealId}. Верни: 1) Саммари; 2) Таблицу рисков; 3) Черновик претензии.`,
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Файл договора во вложении.",
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

    // Call OpenAI Chat Completion API
    const aiResponse = await ai.chat.completions.create({
      model: "gpt-4o",
      messages,
    });
    const answer =
      aiResponse.choices?.[0]?.message?.content || "Пустой ответ от AI.";

    // Send response back to Bitrix chat
    await sendToBitrix(chatId, answer);
    res.json({ ok: true });
  } catch (error) {
    const errorMessage = error?.message || "Unknown error";
    // Try to send error to chat if chatId available
    if (chatId) {
      try {
        await sendToBitrix(chatId, `Ошибка анализа: ${errorMessage}`);
      } catch (sendErr) {
        // ignore errors while sending error message
      }
    }
    res.status(500).json({ error: errorMessage });
  }
});
/**
 * Additional GET endpoints for debug and fallback. These handle requests to the
 * root URL and to GET /legal. The root returns a simple status message, and
 * GET /legal responds with a 405 to indicate that only POST requests are
 * supported on that route.
 */
app.get("/", (req, res) => {
  res.status(200).send("EvaLegalAI Core server is running");
});

app.get("/legal", (req, res) => {
  res.status(405).send(
    "Method Not Allowed. This endpoint only accepts POST requests with a JSON body containing chatId, dealId, fileUrl and task."
  );
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`EvaLegalAI Core listening on port ${PORT}`);
});
