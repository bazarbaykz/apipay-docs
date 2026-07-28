# OpenAPI спецификация

Полная спецификация OpenAPI 3.0 для ApiPay REST API — [openapi.yaml](../openapi.yaml).

Файл можно импортировать в [Swagger Editor](https://editor.swagger.io/), [Postman](https://www.postman.com/)
или [Insomnia](https://insomnia.rest/) — как и в любой другой OpenAPI-совместимый инструмент.
Вы получите готовую коллекцию запросов, описания полей и схемы ответов для тестирования интеграции.

## Конфигурация

| Параметр | Значение |
|----------|----------|
| Base URL | `https://api.apipay.kz/api/v1` |
| Аутентификация | Заголовок `X-API-Key: your_api_key` |
| Общий лимит | 200 запросов/минуту на API-ключ |

Отдельные лимиты для некоторых эндпоинтов описаны в разделе [Коды ошибок](../docs/ru/errors.md).

## Partner API

У [Partner API](../docs/ru/partner-api.md) — для CRM-интеграторов, которые подключают мерчантов
и выставляют счета от их имени — своя спецификация:
[OpenAPI спецификация Partner API](openapi-specifikaciya-partner-api.md).
