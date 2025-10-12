import dotenv from "dotenv";

const DEFAULT_PORT = 3000;
const DEFAULT_REQUEST_BODY_LIMIT = "20mb";
const REQUIRED_ENVIRONMENT_KEYS = ["OPENAI_API_KEY", "BITRIX_URL"];

dotenv.config();

export function parseAllowedChatIds(value = "") {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Loads and validates configuration from the provided environment variables.
 * @param {NodeJS.ProcessEnv} env - Environment variables collection.
 * @returns {{
 *   openAiApiKey: string,
 *   bitrixUrl: string,
 *   allowedChatIds: string[],
 *   port: number,
 *   requestBodyLimit: string,
 * }}
 */
export function loadConfig(env = process.env) {
  const missingKeys = REQUIRED_ENVIRONMENT_KEYS.filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingKeys.join(", ")}`
    );
  }

  return {
    openAiApiKey: env.OPENAI_API_KEY,
    bitrixUrl: env.BITRIX_URL,
    allowedChatIds: parseAllowedChatIds(env.ALLOWED_CHAT_IDS),
    port: Number(env.PORT) || DEFAULT_PORT,
    requestBodyLimit: env.REQUEST_BODY_LIMIT || DEFAULT_REQUEST_BODY_LIMIT,
  };
}

export const ENV_CONSTANTS = {
  DEFAULT_PORT,
  DEFAULT_REQUEST_BODY_LIMIT,
  REQUIRED_ENVIRONMENT_KEYS,
};
