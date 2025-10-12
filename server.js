import express from "express";
import morgan from "morgan";
import axios from "axios";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const BITRIX_URL = process.env.BITRIX_URL || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ALLOWED_CHAT_IDS = (process.env.ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const FILE_DOWNLOAD_TIMEOUT_MS = 15_000;
const FILE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024;
const BITRIX_TIMEOUT_MS = 10_000;
const BITRIX_MAX_ATTEMPTS = 2;

let bitrixEndpoint = null;
if (BITRIX_URL) {
  try {
    bitrixEndpoint = new URL("im.message.add", BITRIX_URL).toString();
  } catch (error) {
    console.error("Invalid BITRIX_URL provided. Messages will not be delivered.", error);
    bitrixEndpoint = null;
  }
}

let openAiClient = null;
if (OPENAI_API_KEY) {
  openAiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
}

const app = express();

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.get("/", (req, res) => {
  res.status(200).send("EvaLegalAI Core server is running");
});

app.get("/legal", (req, res) => {
  res
    .status(405)
    .send("Method Not Allowed. Use POST with JSON: { chatId, dealId, fileUrl, task }");
});

app.post("/legal", async (req, res) => {
  try {
    const request = validateRequestBody(req.body);

    if (ALLOWED_CHAT_IDS.length > 0 && !ALLOWED_CHAT_IDS.includes(request.chatId)) {
      return res.status(403).json({ error: "Chat is not authorized" });
    }

    if (!BITRIX_URL || !bitrixEndpoint) {
      return res
        .status(500)
        .json({ error: "Server configuration error: BITRIX_URL is not set" });
    }

    await downloadFileWithLimit(request.fileUrl);

    const aiMessage = await generateAiResponse({
      task: request.task,
      dealId: request.dealId,
      fileUrl: request.fileUrl,
    });

    const sentToBitrix = await sendMessageToBitrix(request.chatId, aiMessage);
    if (!sentToBitrix) {
      console.error("Failed to deliver message to Bitrix. Check previous logs for details.");
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    const publicMessage = error?.publicMessage || "Internal server error";

    if (error?.logMessage) {
      console.error(error.logMessage);
    } else {
      console.error(publicMessage, error);
    }

    return res.status(statusCode).json({ error: publicMessage });
  }
});

function validateRequestBody(body = {}) {
  if (typeof body !== "object" || body === null) {
    throw createHttpError(400, "Invalid request: JSON body is required", "Body is not an object");
  }

  const { chatId, dealId, fileUrl, task } = body;

  const normalizedChatId = normalizeChatId(chatId);
  if (!normalizedChatId) {
    throw createHttpError(400, "Invalid request: chatId is required", "chatId missing or invalid");
  }

  if (typeof task !== "string" || task.trim().length === 0) {
    throw createHttpError(400, "Invalid request: task must be a non-empty string", "task invalid");
  }

  if (typeof fileUrl !== "string" || fileUrl.trim().length === 0) {
    throw createHttpError(400, "Invalid request: fileUrl must be a valid URL", "fileUrl missing");
  }

  try {
    // Validate URL format.
    new URL(fileUrl);
  } catch {
    throw createHttpError(400, "Invalid request: fileUrl must be a valid URL", "fileUrl invalid");
  }

  return {
    chatId: normalizedChatId,
    dealId,
    fileUrl,
    task: task.trim(),
  };
}

function normalizeChatId(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "";
}

async function downloadFileWithLimit(fileUrl) {
  try {
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: FILE_DOWNLOAD_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      },
    });

    const contentLengthHeader = response.headers?.["content-length"];
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > FILE_SIZE_LIMIT_BYTES) {
        throw new Error("File exceeds maximum allowed size");
      }
    }

    const buffer = Buffer.from(response.data);
    if (buffer.byteLength > FILE_SIZE_LIMIT_BYTES) {
      throw new Error("File exceeds maximum allowed size");
    }

    return buffer;
  } catch (error) {
    const logMessage = buildNetworkErrorMessage(error, "download file");
    throw createHttpError(400, "File download failed", logMessage);
  }
}

async function generateAiResponse({ task, dealId, fileUrl }) {
  if (!openAiClient) {
    return `[DEMO] AI disabled: unable to process task "${task}" for deal "${dealId ?? "n/a"}".`;
  }

  try {
    const response = await openAiClient.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are EvaLegalAI, a legal assistant who summarizes contract risks and next steps in Russian.",
        },
        {
          role: "user",
          content: `Выполни задачу: ${task}\nID сделки: ${dealId ?? "n/a"}\nСсылка на договор: ${fileUrl}`,
        },
      ],
      max_output_tokens: 500,
    });

    const text = response.output_text?.trim();
    if (text) {
      return text;
    }

    return "AI processing completed without a detailed answer. Пожалуйста, проверьте договор вручную.";
  } catch (error) {
    console.error("Network error (OpenAI)", error);
    return "[DEMO] AI temporarily unavailable. Команда уведомлена, попробуйте позже.";
  }
}

async function sendMessageToBitrix(chatId, message) {
  if (!bitrixEndpoint) {
    return false;
  }

  const payload = {
    DIALOG_ID: chatId,
    MESSAGE: message,
  };

  for (let attempt = 1; attempt <= BITRIX_MAX_ATTEMPTS; attempt += 1) {
    try {
      await axios.post(bitrixEndpoint, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: BITRIX_TIMEOUT_MS,
      });
      return true;
    } catch (error) {
      const isNetworkError = axios.isAxiosError(error) && !error.response;
      const logMessage = buildNetworkErrorMessage(error, "send to Bitrix");
      console.error(logMessage);

      if (!isNetworkError || attempt === BITRIX_MAX_ATTEMPTS) {
        return false;
      }
    }
  }

  return false;
}

function createHttpError(statusCode, publicMessage, logMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  error.logMessage = logMessage;
  return error;
}

function buildNetworkErrorMessage(error, context) {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      return `Network error (${context}): request timeout`;
    }
    if (error.response) {
      return `Network error (${context}): received status ${error.response.status}`;
    }
    return `Network error (${context}): ${error.message}`;
  }

  return `Network error (${context}): ${error?.message || "unknown error"}`;
}

app.listen(PORT, () => {
  console.log(`EvaLegalAI Core server is running on port ${PORT}`);
});

export default app;
