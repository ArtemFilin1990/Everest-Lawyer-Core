import axios from "axios";

/**
 * Factory for Bitrix24 client interactions.
 * @param {{ baseUrl: string, httpClient?: typeof axios }} options
 */
export function createBitrixClient({ baseUrl, httpClient = axios } = {}) {
  if (!baseUrl) {
    throw new Error("Bitrix base URL is required");
  }

  return {
    /**
     * Sends a message into the specified Bitrix24 chat dialog.
     * @param {string|number} chatId - Bitrix chat identifier.
     * @param {string} message - Message contents.
     */
    async sendMessage(chatId, message) {
      if (!chatId) {
        throw new Error("chatId is required to send a Bitrix message");
      }
      if (typeof message !== "string" || !message.trim()) {
        throw new Error("message is required to send a Bitrix message");
      }

      await httpClient.post(`${baseUrl}im.message.add`, {
        DIALOG_ID: chatId,
        MESSAGE: message,
      });
    },
  };
}
