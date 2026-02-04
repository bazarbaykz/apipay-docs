# ApiPay.kz

[![API Version](https://img.shields.io/badge/API-v1.0-blue.svg)](https://bpapi.bazarbay.site/api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-available-green.svg)](docs/ru/getting-started.md)

**REST API для Kaspi Pay — автоматизация счетов, возвратов и рекуррентных платежей.**

ApiPay.kz — независимый сервис с REST API для Kaspi Pay. Автоматизируйте выставление счетов по номеру телефона, обрабатывайте возвраты и управляйте рекуррентными платежами.

[English Documentation](README.md)

## Быстрый старт

### 1. Подготовка

Перед созданием счетов необходимо верифицировать организацию:

1. Получите API ключ в [Личном кабинете ApiPay.kz](https://baypay.bazarbay.site/login)
2. Откройте приложение **Kaspi Business** на телефоне
3. Перейдите в **Настройки → Сотрудники → Добавить сотрудника**
4. Добавьте сервисный номер (из Настройки → Подключение) с правами **"Бухгалтер"**
5. Пройдите верификацию в **Главная → Верификация**

### 2. Создание счёта

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Ответ:
```json
{
  "id": 42,
  "payment_url": "https://kaspi.kz/pay/...",
  "status": "pending"
}
```

**Перенаправьте клиента на `payment_url` для оплаты.**

## Обзор API

| Эндпоинт | Описание |
|----------|----------|
| `POST /invoices` | Создание счёта на оплату |
| `GET /invoices` | Список счетов |
| `GET /invoices/:id` | Получение счёта |
| `POST /invoices/:id/cancel` | Отмена счёта |
| `POST /invoices/:id/refund` | Возврат по счёту |
| `POST /recurring-invoices` | Создание рекуррентного счёта |
| `GET /recurring-invoices` | Список рекуррентных счетов |

## Конфигурация

| Параметр | Значение |
|----------|----------|
| Base URL | `https://bpapi.bazarbay.site/api` |
| Аутентификация | Заголовок `X-API-Key: your_api_key` |
| Rate Limit | 60 запросов/минуту |

## Документация

- [Начало работы](docs/ru/getting-started.md) — Подготовка, верификация, первый счёт
- [Счета](docs/ru/invoices.md) — Создание, список, отмена счетов
- [Рекуррентные платежи](docs/ru/recurring.md) — Подписки и регулярные списания
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
- **Личный кабинет**: [baypay.bazarbay.site](https://baypay.bazarbay.site)
- **Issues**: [GitHub Issues](../../issues)

## Лицензия

Проект распространяется под лицензией MIT — см. файл [LICENSE](LICENSE).

## Вклад в проект

Мы рады вашим предложениям! Пожалуйста, прочитайте [CONTRIBUTING.md](CONTRIBUTING.md).

---

Сделано с любовью в Казахстане
