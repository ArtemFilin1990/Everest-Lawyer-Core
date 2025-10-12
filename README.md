# Eva Legal Core

Eva Legal Core обрабатывает запросы Bitrix24 и формирует ответы для юридических консультаций. Сервис принимает входящие документы, анализирует их с помощью OpenAI (или возвращает демо-ответ) и отправляет итоговое сообщение в чат Bitrix24.

## Установка

```bash
npm ci
```

## Запуск

```bash
npm start
```

Приложение слушает порт, определённый переменной `PORT` (по умолчанию `3000`).

## Переменные окружения

| Переменная         | Назначение                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| `PORT`             | Порт HTTP-сервера (опционально).                                                |
| `OPENAI_API_KEY`   | Ключ OpenAI. Если не задан, сервис возвращает демо-ответ без обращения к OpenAI. |
| `BITRIX_URL`       | Базовый URL REST API Bitrix24, например `https://<domain>.bitrix24.ru/rest/<user>/<token>/`. |
| `ALLOWED_CHAT_IDS` | Список разрешённых идентификаторов чатов, перечисленных через запятую. Пустое значение разрешает все чаты. |

## Проверка

```bash
curl -fsSL https://eva-legal-core.onrender.com/health
curl -i https://eva-legal-core.onrender.com/
curl -i https://eva-legal-core.onrender.com/legal
curl -s -X POST https://eva-legal-core.onrender.com/legal \
  -H 'Content-Type: application/json' \
  -d '{
    "chatId": "123",
    "dealId": 1,
    "fileUrl": "https://example.com/sample.pdf",
    "task": "проанализируй договор и верни риски"
  }'
```

## Docker

```bash
docker build -t eva-legal-core .
docker run --rm -p 3000:3000 --env-file .env.example eva-legal-core
```
