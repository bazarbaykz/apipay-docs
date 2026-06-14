# Webhooks

Webhooks доставляют уведомления в реальном времени при возникновении платёжных событий.

## Настройка

Настройте webhooks в [Личном кабинете ApiPay.kz](https://apipay.kz) → Настройки → Подключение:

1. Нажмите **Добавить Webhook**
2. Введите URL вашего webhook
3. Сохраните и скопируйте **secret** (показывается только один раз!)

> **Все даты в вебхуках — в UTC** (ISO 8601, `+00:00`).

## События

ApiPay отправляет 12 типов событий:

| Событие | Описание |
|---------|----------|
| `invoice.status_changed` | Изменился статус счёта |
| `invoice.qr_scanned` | Клиент отсканировал QR (status остаётся `pending`, `qr_substate=scanned`) |
| `invoice.refunded` | Прошёл (или не прошёл) возврат по счёту |
| `subscription.created` | Создана подписка |
| `subscription.payment_succeeded` | Оплачен очередной счёт подписки |
| `subscription.payment_failed` | Счёт подписки не оплачен |
| `subscription.grace_period_started` | Подписка вошла в льготный период |
| `subscription.expired` | Подписка истекла |
| `subscription.paused` | Подписка приостановлена |
| `subscription.resumed` | Подписка возобновлена |
| `subscription.cancelled` | Подписка отменена |
| `webhook.test` | Тестовое событие из личного кабинета |

### invoice.status_changed

Отправляется при изменении статуса счёта.

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "15000.00",
    "subtotal": "16500.00",
    "discount_sum": "1500.00",
    "discount_percentage": "10",
    "status": "paid",
    "description": "Оплата заказа",
    "kaspi_invoice_id": "13234689513",
    "client_name": "Иван Иванов",
    "client_phone": "87071234567",
    "is_sandbox": false,
    "kaspi_source_type": "GOLD",
    "kaspi_sale_type": "Remote",
    "paid_at": "2026-02-12T14:35:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:35:01+00:00"
}
```

> **Примечание:** Поля `subtotal`, `discount_sum` и `discount_percentage` появляются только при наличии скидки в счёте. Поле `is_sandbox` показывает, был ли ресурс создан в sandbox-режиме. Поля `kaspi_source_type` и `kaspi_sale_type` гейтятся по наличию значения от Kaspi (обрабатывайте как nullable).

#### Счёт не обработан (status: error)

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 43,
    "external_order_id": "order_124",
    "amount": "15000.00",
    "status": "error",
    "description": "Оплата заказа",
    "kaspi_invoice_id": null,
    "client_name": null,
    "client_phone": "87071234567",
    "is_sandbox": false,
    "errored_at": "2026-02-12T14:40:00+00:00",
    "error_message": "Этот номер телефона не зарегистрирован в Kaspi. Укажите номер с установленным приложением Kaspi.",
    "error_code": "client_not_found"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:40:01+00:00"
}
```

#### Счёт истёк (status: expired)

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 46,
    "external_order_id": "order_125",
    "amount": "15000.00",
    "status": "expired",
    "description": "Оплата заказа",
    "kaspi_invoice_id": "13234689515",
    "client_name": "Иван Иванов",
    "client_phone": "87071234567",
    "is_sandbox": false,
    "expired_at": "2026-02-13T14:35:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-13T14:35:01+00:00"
}
```

#### QR-счёт отменён клиентом (status: cancelled)

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 44,
    "external_order_id": null,
    "amount": "15000.00",
    "status": "cancelled",
    "description": "QR на кассе",
    "kaspi_invoice_id": "13234689514",
    "client_name": null,
    "client_phone": null,
    "is_sandbox": false,
    "cancelled_at": "2026-02-12T14:45:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:45:01+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `invoice.status` | string | Статус счёта: `pending` / `paid` / `cancelled` / `expired` / `error` / `partially_refunded`. Статуса `refunded` не существует — полный возврат оставляет `paid` + `is_fully_refunded=true`. |
| `invoice.kaspi_invoice_id` | string \| null | ID счёта в Kaspi. Появляется уже при `pending` (когда счёт создан в Kaspi); `null` — пока счёт не дошёл до Kaspi. |
| `invoice.paid_at` | string \| null | Время оплаты (ISO 8601). Поле **отсутствует** во всех статусах, кроме `paid` (а не `null` до оплаты). |
| `invoice.cancelled_at` / `expired_at` / `errored_at` | string \| null | Время перехода в соответствующий статус (ISO 8601). Присутствует только при этом статусе. |
| `invoice.error_message` | string \| null | Человекочитаемая причина. При `status=error` присутствует всегда; при `status=cancelled` — только если заполнена (обычно отсутствует при отмене клиентом или через API). В статусах `paid`/`pending`/`expired` отсутствует. |
| `invoice.error_code` | string \| null | Стабильный snake_case-код из каталога (см. [Коды ошибок](errors.md)). Присутствует только если не `null` и только при `status=error`/`cancelled`. Стройте логику по нему, а не по тексту. |
| `invoice.subtotal` / `discount_sum` / `discount_percentage` | string \| null | Только для счетов с корзиной/скидкой (`subtotal` и `discount_sum` приходят вместе). |
| `invoice.kaspi_source_type` | string \| null | Источник средств клиента: `GOLD`, `RED`, `LOAN`, `BUSINESSACCOUNT`, `BANKINTEGRATIONACCOUNT`. Гейтится по наличию значения от Kaspi; список может расширяться. |
| `invoice.kaspi_sale_type` | string \| null | Способ приёма счёта: `Remote`, `QR`, `Restaurant`, `Static`. Гейтится по наличию значения от Kaspi; список может расширяться. |

### invoice.qr_scanned

Только для QR-счетов. Отправляется, когда клиент отсканировал QR и оказался на экране оплаты в приложении Kaspi. Это **суб-состояние**: статус счёта остаётся `pending`, а маркер `qr_substate: "scanned"` показывает, что покупатель уже на шаге оплаты. Шлётся ровно **один раз** на QR и транзиентно — следом приходит терминальный вебхук (`paid` или `cancelled`). Событие аддитивное, HMAC-подпись не менялась.

```json
{
  "event": "invoice.qr_scanned",
  "invoice": {
    "id": 63474,
    "external_order_id": "order-123",
    "amount": "5000.00",
    "status": "pending",
    "qr_substate": "scanned",
    "description": "Заказ №123",
    "kaspi_invoice_id": "13234689514",
    "client_name": null,
    "client_phone": null,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-06-14T10:00:00+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `invoice.status` | string | Всегда `pending` — это суб-состояние, а не смена статуса. Терминальный статус придёт отдельным `invoice.status_changed`. |
| `invoice.qr_substate` | string | `scanned` — клиент отсканировал QR и находится на экране оплаты. |
| `invoice.kaspi_invoice_id` | string \| null | ID счёта в Kaspi. |
| `invoice.client_name` / `client_phone` | null | На этапе сканирования данные клиента ещё неизвестны. |

> Используйте событие как сигнал «покупатель приступил к оплате» (например, обновить UI кассы). Не считайте счёт оплаченным — дождитесь `paid`. Событие транзиентно и может не прийти, если клиент оплатил мгновенно.

### invoice.refunded

Отправляется при возврате по счёту — как при успешном (`completed`), так и при неудачном (`failed`).

```json
{
  "event": "invoice.refunded",
  "refund": {
    "id": 5,
    "amount": "2000.00",
    "status": "completed",
    "kaspi_refund_id": "1126827352",
    "reason": "Возврат товара",
    "created_at": "2026-02-12T10:00:00+00:00",
    "items": [
      {"catalog_item_id": 12, "name": "Кофе", "price": "1000.00", "count": 2, "amount": "2000.00"}
    ]
  },
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "5000.00",
    "subtotal": "5500.00",
    "discount_sum": "500.00",
    "total_refunded": "2000.00",
    "available_for_refund": 3000,
    "is_fully_refunded": false,
    "is_sandbox": false,
    "status": "paid",
    "kaspi_invoice_id": "13234689513"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T10:00:01+00:00"
}
```

#### Возврат не удался (refund.status: failed)

```json
{
  "event": "invoice.refunded",
  "refund": {
    "id": 6,
    "amount": "2000.00",
    "status": "failed",
    "kaspi_refund_id": null,
    "reason": "Возврат товара",
    "created_at": "2026-02-12T10:00:00+00:00",
    "error_code": "refund_window_expired"
  },
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "5000.00",
    "total_refunded": "0.00",
    "available_for_refund": "5000.00",
    "is_fully_refunded": false,
    "is_sandbox": false,
    "status": "paid",
    "kaspi_invoice_id": "13234689513"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T10:00:01+00:00"
}
```

**Поля payload**

| Поле | Тип | Описание |
|------|-----|----------|
| `refund.status` | string | `pending` / `processing` / `completed` / `failed`. Вебхук приходит и на `completed`, и на `failed`. |
| `refund.kaspi_refund_id` | string \| null | ID возврата в Kaspi; `null` при неудаче. |
| `refund.error_code` | string \| null | Только при `status=failed`. Например `refund_window_expired` — истёк срок возврата (~14 дней). Поля `error_message` в вебхуке нет by design — текст смотрите в `GET /invoices/{id}/refunds` или резолвите код по каталогу. |
| `refund.items` | array \| null | Позиции возврата (только для позиционных возвратов): `catalog_item_id`, `name`, `price`, `count`, `amount`. |
| `invoice.available_for_refund` | number | Сумма, ещё доступная для возврата. Приходит числом (float), в отличие от `amount` и `total_refunded` (строки). |
| `invoice.status` | string | Статус счёта после возврата. Полный возврат статус **НЕ меняет** (остаётся `paid` — или `partially_refunded`, если ранее был частичный) + `is_fully_refunded=true`; первый частичный переводит в `partially_refunded` (и дополнительно приходит `invoice.status_changed`). |

### subscription.created

Отправляется при создании подписки.

```json
{
  "event": "subscription.created",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-03-01T00:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-01T12:00:01+00:00"
}
```

Первый счёт будет выставлен в `next_billing_at` (или сразу, если при создании передан `bill_immediately`).

### subscription.payment_succeeded

Отправляется при успешном платеже по подписке.

```json
{
  "event": "subscription.payment_succeeded",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-03-01T00:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "invoice_id": 200,
  "amount": "5000.00",
  "paid_at": "2026-02-01T12:00:00+00:00",
  "source": "My API Key",
  "timestamp": "2026-02-01T12:00:01+00:00"
}
```

### subscription.payment_failed

Отправляется при неудачном платеже по подписке.

```json
{
  "event": "subscription.payment_failed",
  "subscription": {
    "id": 10,
    "phone_number": "87071234567",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "failed_attempts": 2,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "invoice_id": 201,
  "amount": "5000.00",
  "reason": "Invoice expired",
  "attempt_number": 2,
  "source": "My API Key",
  "timestamp": "2026-02-02T12:00:01+00:00"
}
```

> Пока `attempt_number` меньше `max_retry_attempts` (по умолчанию 3), система **сама** перевыставит счёт периода с интервалом `retry_interval_hours` (по умолчанию 24 ч). Ничего пересоздавать не нужно — просто уведомите клиента (`attempt_number`, `reason`). Счёт подписки со статусом `error` (например `client_not_found`) провалом платежа **не считается** — это событие не придёт, отслеживайте invoice-вебхук `error`.

### subscription.grace_period_started

Отправляется когда подписка входит в льготный период после неудачных попыток.

```json
{
  "event": "subscription.grace_period_started",
  "subscription": {
    "id": 10,
    "phone_number": "87071234567",
    "amount": "5000.00",
    "status": "active",
    "failed_attempts": 3,
    "in_grace_period": true,
    "is_sandbox": false
  },
  "grace_period_days": 3,
  "expires_at": "2026-02-05T12:00:00+00:00",
  "source": "My API Key",
  "timestamp": "2026-02-02T12:00:01+00:00"
}
```

Подписка ещё активна `grace_period_days` дней (по умолчанию 3). Любая успешная оплата снимает льготный период.

### subscription.expired

Отправляется когда подписка истекает после всех неудачных повторов.

```json
{
  "event": "subscription.expired",
  "subscription": {
    "id": 10,
    "phone_number": "87071234567",
    "amount": "5000.00",
    "status": "expired",
    "next_billing_at": null,
    "failed_attempts": 3,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-05T12:00:01+00:00"
}
```

Биллинг остановлен навсегда, реактивации нет. Для возобновления создайте новую подписку.

### subscription.paused

Отправляется при приостановке подписки (`POST /subscriptions/{id}/pause`).

```json
{
  "event": "subscription.paused",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "paused",
    "next_billing_at": "2026-03-01T00:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-10T09:00:00+00:00"
}
```

Счета не выставляются до возобновления.

### subscription.resumed

Отправляется при возобновлении подписки.

```json
{
  "event": "subscription.resumed",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-03-15T09:30:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-15T09:30:00+00:00"
}
```

`next_billing_at` пересчитан от момента возобновления — пропущенные периоды не доначисляются.

### subscription.cancelled

Отправляется при отмене подписки.

```json
{
  "event": "subscription.cancelled",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Иван Иванов",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "cancelled",
    "next_billing_at": "2026-03-01T00:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-20T18:00:00+00:00"
}
```

Подписка отменена безвозвратно: `next_billing_at` сохраняет последнее значение, счета больше не выставляются. Для возобновления создайте новую подписку.

### webhook.test

Отправляется при тестировании webhook из личного кабинета (Настройки → API-ключи → Тест вебхука). Фиктивный счёт со `status=test` — receiver должен спокойно его игнорировать.

```json
{
  "event": "webhook.test",
  "source": "test",
  "timestamp": "2026-01-15T10:00:00Z"
}
```

## Когда приходит вебхук

Этот раздел перечисляет события, при которых ApiPay шлёт вебхук, и в каком статусе он приходит. Технические статусы `processing`/`cancelling` вебхуков **не порождают**.

| Событие | Статус | Когда приходит |
|---------|--------|----------------|
| `invoice.status_changed` | `pending` | Счёт создан в Kaspi и ожидает оплату. Для счетов по номеру (`POST /invoices`) это первый вебхук после 201-ответа со `status=processing`. Для QR-счетов (`POST /invoices/qr`) `pending`-вебхук **не** отправляется — статус возвращается синхронно в 201-ответе; первый вебхук по QR-счёту — оплата, отмена, истечение или ошибка. |
| `invoice.qr_scanned` | `pending` | Только QR: клиент отсканировал QR (`qr_substate=scanned`). Статус остаётся `pending`, суб-состояние. Один раз, транзиентно — далее `paid` или `cancelled`. |
| `invoice.status_changed` | `paid` | Счёт оплачен. Может прийти и **после** `cancelled`/`expired` — оплата в последний момент выигрывает гонку (см. «Переходы статусов»). |
| `invoice.status_changed` | `cancelled` | Счёт отменён: клиентом (свернул/закрыл приложение), вами через API или кассиром. Новый QR на той же кассе старый **не** отменяет. |
| `invoice.status_changed` | `expired` | Счёт истёк: счёт по номеру — 24 часа в Kaspi; QR — минуты, только когда Kaspi отдал терминал (не по локальному таймеру). |
| `invoice.status_changed` | `error` | Техническая ошибка — счёт финализирован, система больше **не** повторяет попытки по этому счёту. Причина — в `error_code`/`error_message` (см. «Сценарии реагирования»). |
| `invoice.status_changed` | `partially_refunded` | Первый частичный возврат по счёту (дополнительно к `invoice.refunded`). Повторные частичные возвраты статус не меняют. |
| `invoice.refunded` | `completed` | Возврат проведён. Включает возвраты, сделанные кассиром в приложении Kaspi (импортируются автоматически). |
| `invoice.refunded` | `failed` | Возврат не удался (`refund.error_code`). Система сама **не** повторяет; сумма не блокируется — можно создать новый возврат. |
| `subscription.created` | — | Подписка создана. Счета по подписке выставляет система автоматически в `next_billing_at` (или сразу при `bill_immediately`). По каждому счёту приходят обычные invoice-вебхуки. |
| `subscription.payment_succeeded` | — | Очередной счёт подписки оплачен. `failed_attempts` сброшен, льготный период (если был) снят. |
| `subscription.payment_failed` | — | Счёт подписки истёк или отменён (`reason`). Пока попыток меньше `max_retry_attempts` система сама перевыставит счёт — ничего пересоздавать не нужно. |
| `subscription.grace_period_started` | — | Все попытки исчерпаны; подписка ещё активна `grace_period_days` дней. Любая успешная оплата снимает льготный период. |
| `subscription.expired` | — | Льготный период истёк — биллинг остановлен навсегда. Для возобновления создайте новую подписку. |
| `subscription.paused` | — | Подписка приостановлена. Счета не выставляются. |
| `subscription.resumed` | — | Подписка возобновлена; `next_billing_at` пересчитан от момента возобновления. |
| `subscription.cancelled` | — | Подписка отменена безвозвратно. |
| `webhook.test` | — | Ручной тест из ЛК. Фиктивный счёт со `status=test` — спокойно игнорируйте. |

## Переходы статусов

Гарантия: ровно **один** вебхук на реальный переход статуса. Дубли подряд одного статуса, технические `processing`/`cancelling`, «протухший» `pending` после терминального статуса и `error` после `paid` — подавляются. При этом повторная доставка одного и того же перехода возможна (ретраи после частичной доставки) — дедуплицируйте по `(invoice.id, status)` и `(refund.id, status)`. Отвечайте `200 OK` быстро (≤5 секунд), обрабатывайте асинхронно.

**Разрешённые переходы:**

| Из | В | Комментарий |
|----|---|-------------|
| `pending` | `paid` / `cancelled` / `expired` / `error` | обычный жизненный цикл |
| `cancelled` / `expired` | `paid` | оплата в последний момент выигрывает гонку — обработайте как «деньги получены»: отгрузите или сделайте возврат. Это не баг. |
| `error` | `pending` | реконсиляция: счёт на самом деле успел создаться в Kaspi — следуйте последнему статусу |
| `paid` | `partially_refunded` | первый частичный возврат |

**Никогда не происходят:**

| Переход | Комментарий |
|---------|-------------|
| терминальный → `pending` | кроме `error → pending` (реконсиляция) |
| `paid → error` | подавляется как инцидент |
| `error → paid` | невозможен |

**Без вебхука:** ответ 202 на отмену переводит счёт в `cancelling` **без** вебхука; если Kaspi отказал в отмене (обычно счёт уже оплачен) — счёт тихо возвращается в `pending`, а реальный статус (обычно `paid`) доставит синхронизация в течение минут. После 202 не считайте счёт отменённым — ждите вебхук.

## Сценарии реагирования

Когда вебхук приносит `status=error` (счёт) или `status=failed` (возврат) — операция финализирована: система уже исчерпала собственные ретраи и больше **не** будет повторять её сама. «Повторить» всегда означает «создать новую операцию». Пока счёт в `processing` — система ретраит сама, вмешиваться не нужно (легитимный бэклог может держать счёт в `processing` больше часа при троттлинге Kaspi).

| Код ошибки | Что произошло | Что делает система | Что делать вам |
|-----------|---------------|--------------------|----------------|
| `client_not_found` | Номер телефона не зарегистрирован в Kaspi | Финализирует счёт сразу, без ретраев | Запросите у клиента другой номер и создайте новый счёт |
| `network_unavailable` | Сеть/Kaspi были недоступны | Ретраила сама; вебхук означает, что ретраи исчерпаны | Создайте новый счёт/возврат через 1–2 минуты |
| `session_transient` | Временный сбой сессии кассира | Автоматически инвалидировала сессию и ретраила | Создайте новый счёт позже; если повторяется — переподключите кассира в ЛК |
| `kaspi_throttled` | Kaspi ограничил частоту запросов кассы | Автоматически замедляет очередь этой кассы (интервал до 3 минут на счёт) и ретраит; вебхук = финализация | Пока счёт в `processing` — ничего. После `error` — новый счёт через 2–3 минуты; снизьте темп создания счетов |
| `organization_not_configured` | К организации не подключён кассир Kaspi | Финализирует сразу | Подключите кассира: ЛК → Настройки → Авторизация Kaspi |
| `invoice_already_paid` | Попытка отменить уже оплаченный счёт | Отмену остановила; деньги получены | Не отменяйте; если нужно вернуть деньги — создайте возврат |
| `invoice_already_cancelled` | Счёт уже отменён | — | Ничего: желаемое состояние уже достигнуто |
| `invoice_not_found_in_kaspi` | Kaspi не нашёл счёт при отмене | Финализирует `error` | Обратитесь в поддержку |
| `refund_window_expired` | Истёк срок возврата (~14 дней) или возврат уже сделан | Возврат `failed`, ретраев нет | Не повторяйте; сообщите клиенту или обратитесь в поддержку |
| `qr_render_failed` | Не сформировалось изображение QR | Счёт финализирован в `error` (и 500-ответ, и вебхук) | Повторите `POST /invoices/qr` — создастся новый счёт |
| `kaspi_session_invalid` | Сессия кассира истекла в момент создания QR | Счёт финализирован в `error`; сессия инвалидирована | Повторите позже; если повторяется — переподключите кассира |
| `kaspi_error` | Неклассифицированная ошибка Kaspi | Зависит от причины; для QR — счёт `error` + вебхук | Читайте `message`/`error_message`; повторите или обратитесь в поддержку |
| `unknown_error` | Непредвиденная ошибка (в т.ч. исчерпаны все попытки создания) | Финализировала после всех ретраев | Создайте новый счёт; если повторяется — поддержка |

**Сценарии без `error_code`:**

- **Новый QR на той же кассе** — QR-счета сосуществуют: создание нового QR **не** отменяет прежние, вебхука-замены (`cancelled` с «Заменён новым QR-счётом #N») больше нет. Два параллельных `POST /invoices/qr` оба получают `201` + `pending`. Реагируйте по каждому `invoice.id` отдельно — при оплате нескольких QR придёт несколько `paid`. (`409 superseded` — defensive-ветка, на практике недостижима, на ней логику не стройте.)
- **Клиент отменил QR** — вебхук `cancelled` = реальная отмена клиентом (свернул/закрыл приложение: `NotConfirmedByUser` / `CancelledByUser`), а не системная замена. При необходимости создайте новый счёт.
- **Клиент отсканировал QR** — вебхук `invoice.qr_scanned` (`qr_substate=scanned`, статус остаётся `pending`): покупатель на экране оплаты. Сигнал «оплата начата», не считайте счёт оплаченным — дождитесь `paid`.
- **Счёт истёк** — вебхук `expired` (счёт по номеру — 24 ч; QR — минуты, по терминалу от Kaspi). При необходимости создайте новый счёт.
- **Оплата после отмены/истечения** — вебхук `paid` после `cancelled`/`expired`: деньги получены — отгрузите или сделайте возврат.
- **Возврат к `pending` после `error`** — корректирующий `pending`-вебхук (реконсиляция). Следуйте последнему статусу.

## Верификация подписи

Каждый запрос включает заголовок `X-Webhook-Signature: sha256=<HMAC-SHA256>` — это HMAC-SHA256 по сырому телу запроса. Заголовок отсутствует, если у ключа не задан webhook secret.

### JavaScript

```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

### Python

```python
import hmac, hashlib

def verify_webhook(payload, signature, secret):
    expected = 'sha256=' + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### PHP

```php
function verifyWebhook($payload, $signature, $secret) {
    $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    return hash_equals($expected, $signature);
}
```

## Доставка

Все события вебхуков — и по счетам, и по подпискам — повторяются при неудачной доставке.

- **До 11 попыток:** 1 первая доставка + 10 повторов
- **Экспоненциальные интервалы:** 10с, 30с, 1м, 1.5м, 2м, 5м, 10м, 15м, 30м, 1ч — всего около 2 часов
- **Sandbox:** в sandbox-режиме invoice-вебхуки доставляются всего за **3 попытки** (интервалы 5с, 15с). Вебхуки возвратов и подписок всегда используют полные 11 попыток — sandbox-сокращения для них нет
- **Успех:** доставка считается успешной только при HTTP-ответе **2xx**
- **3xx/4xx:** ретраятся только HTTP ≥500, ровно 429 и сетевые ошибки. Ответы 3xx и 4xx (кроме 429) **не** ретраятся — попытка сразу фиксируется как доставленная. Повторить такую доставку можно только вручную: ЛК → Webhook-логи → Retry (для записей со `status=failed`, cooldown между повторами 10 секунд)
- **Все даты в вебхуках — в UTC** (ISO 8601, `+00:00`)

### Circuit breaker

Если ваш endpoint стабильно недоступен, отправка на ключ приостанавливается:

- 5 подряд неудач → пауза 5 минут
- 10 → пауза 30 минут
- 20 → пауза 2 часа
- 50 → полное отключение до ручного вмешательства

Вебхуки за время паузы **не** доотправляются — сверяйте состояние через GET-методы. Любая успешная доставка (или успешный тест-вебхук из ЛК) сбрасывает счётчик. Статус виден в списке API-ключей.

> События `subscription.*` не пишутся в Webhook-логи ЛК: для них нет ручного retry и circuit breaker (известное ограничение).

## Требования к ответу

1. Возвращайте статус **2xx** в течение **5 секунд** (таймаут доставки: 5с на ответ плюс до 3с на установление соединения)
2. Будьте **идемпотентны** — корректно обрабатывайте повторные доставки

### Дедупликация

Дедупликация на стороне клиента **обязательна**: ретрай после частичной доставки нескольким получателям пере-отправляет вебхук всем. Ключи дедупликации:

- `(invoice.id, invoice.status)` — для invoice-событий
- `(refund.id, refund.status)` — для возвратов
- `(event, subscription.id, invoice_id)` — для событий подписки

## Лучшие практики безопасности

1. **Всегда проверяйте подпись**
2. **Используйте HTTPS** в production
3. **Храните secrets в переменных окружения**
4. **Используйте ключи идемпотентности** (см. «Дедупликация»)
