# ApiPay.kz — REST API для Kaspi Pay

[![API Version](https://img.shields.io/badge/API-v2.1.0-blue.svg)](https://api.apipay.kz/api/v1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/bazarbaykz/apipay-docs/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-available-green.svg)](getting-started.md)

**REST API для Kaspi Pay — автоматизация счетов, возвратов, подписок и управления каталогом.**

ApiPay.kz — независимый сервис с REST API для Kaspi Pay. Автоматизируйте выставление счетов по номеру телефона, обрабатывайте возвраты, управляйте подписками и каталогом товаров.

[English Documentation](../en/README.md)

## Быстрый старт

### 1. Подготовка

Начинайте с песочницы — анкета о бизнесе и кассир для неё не нужны:

1. Зарегистрируйтесь в [Личном кабинете ApiPay.kz](https://apipay.kz/login) — новая организация создаётся в песочнице
2. Получите API ключ в Настройки → Подключение — он же будет работать и в рабочем режиме
3. Встройте и проверьте интеграцию в [песочнице](sandbox.md): счета не уходят в Kaspi, деньги не двигаются
4. Путь в рабочий режим: анкета о бизнесе → проверка анкеты → [кассир Kaspi](https://apipay.kz/connect-cashier) (мастер в кабинете, Настройки → Авторизация Kaspi) → тариф → перевод. До одобрения анкеты кассира подключить нельзя. Подробнее — [Начало работы](getting-started.md#путь-в-рабочий-режим)

> После привязки кассира не входите в приложение Kaspi Pay под его номером — это разрывает подключение. Если мастер не проходит, [поддержка в WhatsApp](https://wa.me/77003076512) подключит вручную.
>
> Интеграцию можно поручить ИИ-помощнику — см. [Начало работы → Подключение с ИИ-помощником](getting-started.md#подключение-с-ии-помощником).

### 2. Создание счёта

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Ответ:
```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "processing",
  "paid_at": null,
  "phone": "87001234567",
  "is_imported": false,
  "created_at": "2026-01-15T10:00:00+00:00"
}
```

Счёт создаётся асинхронно: `201` возвращает `status: "processing"`. Финальный статус (`pending` или `error`) придёт вебхуком `invoice.status_changed` либо по `GET /invoices/{id}`. Не создавайте счёт заново, пока он в `processing`.

## Обзор API

| Эндпоинт | Описание |
|----------|----------|
| `POST /invoices` | Создание счёта на оплату |
| `POST /invoices/qr` | QR-счёт для оплаты сразу или ссылка на оплату (`static: true`) |
| `GET /invoices` | Список счетов |
| `GET /invoices/{id}` | Получение счёта |
| `GET /invoices/{id}/receipt` | Чек Kaspi по оплаченному счёту |
| `POST /invoices/{id}/cancel` | Отмена счёта |
| `POST /invoices/{id}/refund` | Возврат по счёту |
| `GET /invoices/{id}/refunds` | Возвраты по счёту |
| `POST /invoices/status/check` | Проверка статусов pending-счетов |
| `GET /refunds` | Список всех возвратов |
| `POST /qr-refunds/links` | Ссылка покупателю «Возврат ApiPay» (запасной путь возврата) |
| `POST /static-qr` | Печатный QR и ссылка на оплату под сделку |
| `GET /webhook-logs` | Журнал доставок вебхуков |
| `GET /webhook-logs/delivery-state` | Пауза отправки вебхуков своего ключа |
| `POST /webhook-test` | Тестовый вебхук на адрес ключа |
| `GET /sandbox/state` | Состояние песочницы (и `PUT`, `POST /sandbox/clear`) |
| `POST /clients/check` | Проверка номера перед выставлением счёта |
| `GET /catalog` | Список товаров каталога |
| `POST /catalog/upload-image` | Загрузка изображения товара |
| `POST /catalog` | Создание товаров |
| `PATCH /catalog/{id}` | Обновление товара |
| `DELETE /catalog/{id}` | Удаление товара |
| `POST /catalog/bulk-delete` | Массовое удаление позиций каталога |
| `GET /catalog/queue` | Остаток очереди каталога: сколько позиций ждут создания, правки и снятия |
| `GET /catalog/errors` | Отказавшие операции каталога за период |
| `POST /catalog/scan` | Поиск товара в Нацкаталоге по штрихкоду |
| `GET /catalog/units` | Единицы измерения |
| `POST /subscriptions` | Создание подписки |
| `GET /subscriptions` | Список подписок |
| `GET /subscriptions/{id}` | Получение подписки |
| `PUT /subscriptions/{id}` | Обновление подписки |
| `POST /subscriptions/{id}/pause` | Приостановка подписки |
| `POST /subscriptions/{id}/resume` | Возобновление подписки |
| `POST /subscriptions/{id}/cancel` | Отмена подписки |
| `GET /subscriptions/{id}/invoices` | Счета подписки |
| `POST /receipts/preview` | Превью фискального чека |
| `POST /receipts` | Выбить фискальный чек |
| `GET /receipts` | История фискальных чеков |
| `GET /receipts/{id}` | Получение фискального чека |
| `GET /cashbox/summary` | Сводка по наличным за день |
| `GET /cashbox/shifts` | Список кассовых смен |
| `POST /cashbox/shifts/close` | Закрытие кассовой смены |
| `GET /cashbox/reconciliation` | Сверка счетов со сменой |
| `GET /cashbox/settings` | Настройки кассы |

## Конфигурация

| Параметр | Значение |
|----------|----------|
| Base URL | `https://api.apipay.kz/api/v1` |
| Аутентификация | Заголовок `X-API-Key: your_api_key` |
| Rate Limit | 200 запросов/минуту на API ключ |

## Документация

- [Начало работы](getting-started.md) — Подготовка, подключение, первый счёт
- [Счета](invoices.md) — Создание, список, отмена счетов
- [Подписки](subscriptions.md) — Автоматическое выставление счетов по расписанию (покупатель оплачивает каждый счёт сам)
- [Каталог](catalog.md) — Управление каталогом товаров
- [Возвраты](refunds.md) — Полные и частичные возвраты
- [Webhooks](webhooks.md) — Уведомления о платежах в реальном времени
- [Песочница](sandbox.md) — Сценарии, исходы и ошибки без настоящих денег
- [Клиенты](clients.md) — Проверка номера перед выставлением счёта
- [Фискальные чеки](receipts.md) — Чеки Kaspi OFD для оплат наличными и через POS другого банка
- [Касса](cashbox.md) — Кассовые смены Kaspi, наличные, сверка и отчёты
- [Коды ошибок](errors.md) — HTTP коды и обработка ошибок
- [Partner API](partner-api.md) — Для CRM-интеграторов: подключайте мерчантов и выставляйте счета от их имени

## Примеры кода

Готовые к запуску примеры на разных языках:

- [JavaScript/Node.js](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/javascript)
- [Python](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/python)
- [PHP](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/php)
- [cURL](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/curl)

## OpenAPI Спецификация

Полная OpenAPI 3.0 спецификация доступна в [openapi.yaml](https://github.com/bazarbaykz/apipay-docs/blob/main/openapi.yaml).

Вы можете импортировать её в [Swagger Editor](https://editor.swagger.io/), [Postman](https://www.postman.com/) или любой другой OpenAPI-совместимый инструмент.

У [Partner API](partner-api.md) отдельная спецификация: [openapi-partner.yaml](https://github.com/bazarbaykz/apipay-docs/blob/main/openapi-partner.yaml).

## Поддержка

- **WhatsApp**: [+7 700 307 6512](https://wa.me/77003076512)
- **Личный кабинет**: [apipay.kz](https://apipay.kz)
- **Issues**: [GitHub Issues](https://github.com/bazarbaykz/apipay-docs/issues)

## Лицензия

Проект распространяется под лицензией MIT — см. файл [LICENSE](https://github.com/bazarbaykz/apipay-docs/blob/main/LICENSE).

## Вклад в проект

Мы рады вашим предложениям! Пожалуйста, прочитайте [CONTRIBUTING.md](https://github.com/bazarbaykz/apipay-docs/blob/main/CONTRIBUTING.md).

---

Сделано с любовью в Казахстане
