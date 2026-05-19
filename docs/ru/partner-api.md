# Partner API

Partner API позволяет платформам и CRM-системам подключать своих клиентов
к ApiPay и выставлять счета от их имени — без ручного создания аккаунтов.

> **Для кого это:** интеграторы (CRM-системы, маркетплейсы, платформы),
> которые подключают мерчантов программно. Если вам нужно просто принимать
> платежи для своего бизнеса — используйте обычный [API](getting-started.md).

## Аутентификация

Все запросы Partner API используют заголовок `X-Partner-Key`:

```
X-Partner-Key: pk_your_partner_key_here
```

Партнёрский ключ выдаётся командой ApiPay после одобрения заявки на
партнёрство. Он показывается только один раз при выдаче и хранится в виде
хеша — сохраните его надёжно, восстановить ключ невозможно.

| Параметр | Значение |
|----------|----------|
| Base URL | `https://bpapi.bazarbay.site` |
| Аутентификация | Заголовок `X-Partner-Key: pk_...` |
| Content-Type | `application/json` |

## Поток онбординга мерчанта

Главный сценарий — подключить мерчанта в ApiPay программно. Авторизация
кассира основана на SMS-коде Kaspi: мерчант сообщает вам код, который ему
прислал Kaspi.

| Шаг | Запрос | Назначение |
|-----|--------|------------|
| 1 | `POST /api/partner/organizations` | Создать организацию мерчанта |
| 2 | `POST /api/partner/organizations/{id}/kaspi-auth/init` | Начать авторизацию кассира |
| 3 | `POST /api/partner/organizations/{id}/kaspi-auth/send-phone` | Kaspi отправляет SMS кассиру |
| 4 | `POST /api/partner/organizations/{id}/kaspi-auth/verify-otp` | Подтвердить код из SMS |
| 5 | `POST /api/partner/organizations/{id}/api-key` | Выдать API-ключ мерчанта + webhook |

> **Важно:** идентификатор авторизации `process_id` живёт 10 минут.
> Шаги 3 и 4 нужно выполнить в этом окне.

Готовые примеры онбординга — в [examples/](../../examples/):
`javascript/partner-onboarding.js`, `python/partner_onboarding.py`,
`php/partner-onboarding.php`, `curl/partner-onboarding.sh`.

## Эндпоинты

### POST /api/partner/organizations

Создать организацию мерчанта. Идемпотентно по `external_id` — повторный
запрос вернёт существующую организацию.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `has_catalog` | boolean | Нет | Создать организацию с каталогом товаров |
| `external_id` | string | Нет | Ваш идентификатор клиента в CRM |

**Ответ** `201 Created` (или `200 OK` при идемпотентном повторе):

```json
{ "success": true, "organization": { ... } }
```

### GET /api/partner/organizations

Список ваших организаций с пагинацией.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `per_page` | number | Нет | Размер страницы: 1–100 (по умолчанию 25) |
| `page` | number | Нет | Номер страницы (по умолчанию 1) |

**Ответ:**

```json
{
  "success": true,
  "organizations": [ ... ],
  "current_page": 1,
  "per_page": 25,
  "total": 42,
  "last_page": 2
}
```

### GET /api/partner/organizations/{id}

Получить карточку организации.

**Ответ:** `{ "success": true, "organization": { ... } }`

### DELETE /api/partner/organizations/{id}

Отвязать организацию: деактивирует её API-ключи и помечает как удалённую.

**Ответ:** `{ "success": true }`

### POST /api/partner/organizations/{id}/kaspi-auth/init

Шаг 1 онбординга — начать авторизацию кассира Kaspi.

**Ответ:** `{ "success": true, "process_id": "..." }` — `process_id` живёт 10 минут.

### POST /api/partner/organizations/{id}/kaspi-auth/send-phone

Шаг 2 онбординга — Kaspi отправляет SMS-код на телефон кассира.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `cashier_phone` | string | Да | Номер кассира в формате `7XXXXXXXXXX` |

**Ответ:** `{ "success": true }`.
Возможные ошибки: `invalid_phone` (422), `not_cashier` (422), `no_process` (409), `sms_failed` (502).

### POST /api/partner/organizations/{id}/kaspi-auth/verify-otp

Шаг 3 онбординга — подтвердить код из SMS.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `otp` | string | Да | Код из SMS, 4–6 цифр |

**Ответ** при успехе: `{ "success": true, "mode": "self", "organization": { ... } }`.
При неверном коде: `{ "success": false, "error": "invalid_otp" }`.

### GET /api/partner/organizations/{id}/kaspi-auth/status

Статус авторизации кассира.

**Ответ:** `{ "success": true, "status": "pending|active|...", "kaspi_connected": true, "expires_at": "..." }`

### POST /api/partner/organizations/{id}/api-key

Создать или перевыпустить `X-API-Key` мерчанта и webhook. Идемпотентно.

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `name` | string | Нет | Название ключа |
| `webhook_url` | string | Да | URL для webhook-уведомлений (приватные и внутренние адреса отклоняются) |
| `webhook_secret` | string | Нет | Секрет для подписи webhook (генерируется автоматически, если не указан) |

**Ответ:**

```json
{
  "success": true,
  "key": "<plaintext, показывается один раз>",
  "key_id": 200,
  "webhook_url": "https://your-crm.example.com/webhooks/kaspi",
  "webhook_secret": "<plaintext>",
  "is_org_default": true,
  "regenerated": false
}
```

`key` показывается только один раз — сохраните его надёжно. Используйте его
как `X-API-Key` для обычного API, чтобы работать от имени мерчанта.

## Объект организации

Все эндпоинты возвращают организацию в едином формате:

```json
{
  "id": 50,
  "name": "ТОО Example",
  "idn": "123456789012",
  "status": "pending|verified|suspended",
  "sandbox_mode": false,
  "has_catalog": false,
  "kaspi_connected": true,
  "session_mode": "self",
  "external_id": "crm-client-42",
  "payment_status": "none|active|expired",
  "payment_expires_at": "2026-06-16T00:00:00+00:00",
  "has_active_payment": false,
  "created_at": "2026-05-16T10:00:00+00:00"
}
```

## Лимиты запросов

| Группа | Лимит |
|--------|-------|
| `partner-api` (все эндпоинты) | 120 запросов/минуту на партнёра |
| `partner-kaspi-auth` (`send-phone`, `verify-otp`) | 10 запросов/минуту на партнёра + организацию |

## Коды ошибок

| HTTP | Значение |
|------|----------|
| 401 | Неверный или отсутствующий `X-Partner-Key` |
| 403 | Нет доступа к запрошенному ресурсу |
| 409 | Конфликт — `no_process` (авторизация не начата или истекла), `already_exists` |
| 422 | Ошибка валидации — `invalid_phone`, `not_cashier` или `webhook_url` с приватным/внутренним адресом |
| 502 | Kaspi API недоступен — `sms_failed` |

## Выставление счетов от имени мерчанта

После онбординга используйте `X-API-Key` мерчанта (из шага 5) с обычным
API — `POST /api/v1/invoices`, подписки, возвраты и т. д.
См. [Начало работы](getting-started.md) и [Счета](invoices.md).
