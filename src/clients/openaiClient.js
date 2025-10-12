import OpenAI from "openai";

/**
 * Creates an OpenAI client instance with the provided API key.
 * @param {string} apiKey - OpenAI API key.
 */
export function createOpenAIClient(apiKey) {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }
  return new OpenAI({ apiKey });
}
