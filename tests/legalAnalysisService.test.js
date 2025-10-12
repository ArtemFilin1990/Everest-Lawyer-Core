import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createLegalAnalysisService,
  buildLegalAnalysisMessages,
  EMPTY_AI_RESPONSE_FALLBACK,
} from "../src/services/legalAnalysisService.js";

const createMockOpenAiClient = (response) => ({
  chat: {
    completions: {
      create: async (payload) => {
        createMockOpenAiClient.lastPayload = payload;
        return response;
      },
    },
  },
});

const createMockHttpClient = (buffer) => ({
  get: async (url, options) => {
    createMockHttpClient.lastRequest = { url, options };
    return { data: buffer };
  },
});

test("buildLegalAnalysisMessages constructs the expected conversation", () => {
  const base64File = Buffer.from("sample").toString("base64");
  const messages = buildLegalAnalysisMessages({
    task: "Проверить договор",
    dealId: "D-100",
    base64File,
  });

  assert.equal(messages.length, 4);
  assert.equal(messages[0].role, "system");
  assert.match(messages[1].content, /Задача: Проверить договор/);
  assert.equal(messages[2].content[0].text, "Файл договора во вложении.");
  assert.equal(messages[3].content[0].data, base64File);
});

test("processLegalRequest resolves with AI answer and requests resources", async () => {
  createMockOpenAiClient.lastPayload = undefined;
  createMockHttpClient.lastRequest = undefined;
  const expectedAnswer = "Готовый отчёт";
  const openAiClient = createMockOpenAiClient({
    choices: [{ message: { content: expectedAnswer } }],
  });
  const httpClient = createMockHttpClient(Buffer.from("binary"));

  const service = createLegalAnalysisService({
    openAiClient,
    httpClient,
    chatAllowlist: [],
  });

  const result = await service.processLegalRequest({
    chatId: "123",
    dealId: "DL-77",
    fileUrl: "https://example.com/contract.pdf",
    task: "Анализ условий",
  });

  assert.equal(result, expectedAnswer);
  assert.equal(createMockHttpClient.lastRequest.url, "https://example.com/contract.pdf");
  assert.deepEqual(createMockHttpClient.lastRequest.options, {
    responseType: "arraybuffer",
  });
  assert.equal(createMockOpenAiClient.lastPayload.model, "gpt-4o");
  assert.equal(createMockOpenAiClient.lastPayload.messages.length, 4);
});

test("processLegalRequest returns fallback text when AI answer is empty", async () => {
  createMockOpenAiClient.lastPayload = undefined;
  createMockHttpClient.lastRequest = undefined;
  const openAiClient = createMockOpenAiClient({
    choices: [{ message: { content: "   " } }],
  });
  const httpClient = createMockHttpClient(Buffer.from("binary"));

  const service = createLegalAnalysisService({
    openAiClient,
    httpClient,
  });

  const result = await service.processLegalRequest({
    chatId: "44",
    dealId: "DL-44",
    fileUrl: "https://example.com/file.pdf",
    task: "",
  });

  assert.equal(result, EMPTY_AI_RESPONSE_FALLBACK);
});

test("processLegalRequest rejects when chat is not allowlisted", async () => {
  createMockOpenAiClient.lastPayload = undefined;
  createMockHttpClient.lastRequest = undefined;
  const openAiClient = createMockOpenAiClient({
    choices: [],
  });
  const httpClient = createMockHttpClient(Buffer.from("binary"));

  const service = createLegalAnalysisService({
    openAiClient,
    httpClient,
    chatAllowlist: ["1", "2"],
  });

  await assert.rejects(
    service.processLegalRequest({
      chatId: "3",
      dealId: "DL-3",
      fileUrl: "https://example.com/file.pdf",
      task: "",
    }),
    (error) => {
      assert.equal(error.message, "chat not allowed");
      assert.equal(error.statusCode, 403);
      return true;
    }
  );
});
