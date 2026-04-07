# ApiPay.kz

[![API Version](https://img.shields.io/badge/API-v2.0-blue.svg)](https://bpapi.bazarbay.site/api/v1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-available-green.svg)](docs/ru/getting-started.md)

**REST API для Kaspi Pay — автоматизация счетов, возвратов, подписок и управления каталогом.**

ApiPay.kz — независимый сервис с REST API для Kaspi Pay. Автоматизируйте выставление счетов по номеру телефона, обрабатывайте возвраты, управляйте подписками и каталогом товаров.

[English Documentation](README.md)

## Быстрый старт

### 1. Подготовка

Перед созданием счетов необходимо подключить организацию:

1. Получите API ключ в [Личном кабинете ApiPay.kz](https://apipay.kz/login)
2. Напишите в [WhatsApp поддержки (+7 708 516 74 89)](https://wa.me/77085167489) — мы подключим ваш Kaspi Business с правами **"Кассира"**
3. Дождитесь подключения организации (обычно 5-30 минут)

### 2. Создание счёта

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Ответ:
```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "pending",
  "created_at": "2025-01-15T10:00:00Z"
}
```

## Обзор API

| Эндпоинт | Описание |
|----------|----------|
| `POST /invoices` | Создание счёта на оплату |
| `GET /invoices` | Список счетов |
| `GET /invoices/{id}` | Получение счёта |
| `POST /invoices/{id}/cancel` | Отмена счёта |
| `POST /invoices/{id}/refund` | Возврат по счёту |
| `GET /invoices/{id}/refunds` | Возвраты по счёту |
| `POST /invoices/status/check` | Проверка статусов pending-счетов |
| `GET /refunds` | Список всех возвратов |
| `GET /catalog` | Список товаров каталога |
| `POST /catalog/upload-image` | Загрузка изображения товара |
| `POST /catalog` | Создание товаров |
| `PATCH /catalog/{id}` | Обновление товара |
| `DELETE /catalog/{id}` | Удаление товара |
| `GET /catalog/units` | Единицы измерения |
| `POST /subscriptions` | Создание подписки |
| `GET /subscriptions` | Список подписок |
| `GET /subscriptions/{id}` | Получение подписки |
| `PUT /subscriptions/{id}` | Обновление подписки |
| `POST /subscriptions/{id}/pause` | Приостановка подписки |
| `POST /subscriptions/{id}/resume` | Возобновление подписки |
| `POST /subscriptions/{id}/cancel` | Отмена подписки |
| `GET /subscriptions/{id}/invoices` | Счета подписки |

## Конфигурация

| Параметр | Значение |
|----------|----------|
| Base URL | `https://bpapi.bazarbay.site/api/v1` |
| Аутентификация | Заголовок `X-API-Key: your_api_key` |
| Rate Limit | 60 запросов/минуту |

## Документация

- [Начало работы](docs/ru/getting-started.md) — Подготовка, подключение, первый счёт
- [Счета](docs/ru/invoices.md) — Создание, список, отмена счетов
- [Подписки](docs/ru/subscriptions.md) — Автоматические списания по расписанию
- [Каталог](docs/ru/catalog.md) — Управление каталогом товаров
- [Возвраты](docs/ru/refunds.md) — Полные и частичные возвраты
- [Webhooks](docs/ru/webhooks.md) — Уведомления о платежах в реальном времени
- [Коды ошибок](docs/ru/errors.md) — HTTP коды и обработка ошибок

## Примеры кода

Готовые к запуску примеры на разных языках:

- [JavaScript/Node.js](examples/javascript/)
- [Python](examples/python/)
- [PHP](examples/php/)
- [cURL](examples/curl/)

## OpenAPI Спецификация

Полная OpenAPI 3.0 спецификация доступна в [openapi.yaml](openapi.yaml).

Вы можете импортировать её в [Swagger Editor](https://editor.swagger.io/), [Postman](https://www.postman.com/) или любой другой OpenAPI-совместимый инструмент.

## Поддержка

- **WhatsApp**: [+7 708 516 7489](https://wa.me/77085167489)
- **Личный кабинет**: [apipay.kz](https://apipay.kz)
- **Issues**: [GitHub Issues](../../issues)

## Лицензия

Проект распространяется под лицензией MIT — см. файл [LICENSE](LICENSE).

## Вклад в проект

Мы рады вашим предложениям! Пожалуйста, прочитайте [CONTRIBUTING.md](CONTRIBUTING.md).

---

Сделано с любовью в Казахстане
