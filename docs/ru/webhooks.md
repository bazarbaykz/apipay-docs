# Webhooks

Webhooks доставляют уведомления в реальном времени при возникновении платёжных событий.

## Настройка

Настройте webhooks в [Личном кабинете ApiPay.kz](https://apipay.kz) → Настройки → Подключение:

1. Нажмите **Добавить Webhook**
2. Введите URL вашего webhook
3. Сохраните и скопируйте **secret** (показывается только один раз!)

## События

### invoice.status_changed

Отправляется при изменении статуса счёта (paid, cancelled, expired).

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
    "client_name": "Иван Иванов",
    "is_sandbox": false,
    "paid_at": "2025-12-25T14:35:00Z"
  },
  "source": "api",
  "timestamp": "2025-12-25T14:35:01Z"
}
```

> **Примечание:** Поля `subtotal`, `discount_sum` и `discount_percentage` появляются только при наличии скидки в счёте. Поле `is_sandbox` показывает, был ли ресурс создан в sandbox-режиме.

### invoice.refunded

Отправляется при возврате по счёту (полном или частичном).

```json
{
  "event": "invoice.refunded",
  "invoice": {
    "id": 42,
    "amount": "15000.00",
    "subtotal": "16500.00",
    "discount_sum": "1500.00",
    "status": "partially_refunded",
    "total_refunded": "5000.00",
    "is_sandbox": false,
    "external_order_id": "order_123"
  },
  "source": "api",
  "timestamp": "2025-12-25T15:00:00Z"
}
```

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
    "next_billing_at": "2026-03-01T00:00:00+05:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "invoice_id": 200,
  "amount": "5000.00",
  "paid_at": "2026-02-01T12:00:00+05:00",
  "source": "My API Key",
  "timestamp": "2026-02-01T12:00:01+05:00"
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
  "timestamp": "2026-02-02T12:00:01+05:00"
}
```

### subscription.grace_period_started

Отправляется когда подписка входит в льготный период после неудачного платежа.

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
  "expires_at": "2026-02-05T12:00:00+05:00",
  "source": "My API Key",
  "timestamp": "2026-02-02T12:00:01+05:00"
}
```

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
  "timestamp": "2026-02-05T12:00:01+05:00"
}
```

### webhook.test

Отправляется при тестировании webhook из личного кабинета.

```json
{
  "event": "webhook.test",
  "source": "test",
  "timestamp": "2026-01-15T10:00:00Z"
}
```

## Верификация подписи

Каждый запрос включает заголовок `X-Webhook-Signature: sha256=<HMAC-SHA256>`.

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

## Политика повторов

- **Webhooks счетов** — Не повторяются
- **Webhooks подписок** — Повторяются до 3 раз с интервалами 1, 5 и 15 минут

## Требования к ответу

1. Возвращайте **2xx статус** в течение 30 секунд
2. Будьте **идемпотентны** — корректно обрабатывайте повторные доставки

## Лучшие практики безопасности

1. **Всегда проверяйте подпись**
2. **Используйте HTTPS** в production
3. **Храните secrets в переменных окружения**
4. **Используйте ключи идемпотентности** — `invoice.id` + `status`
