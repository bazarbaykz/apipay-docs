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
    "kaspi_invoice_id": "13234689513",
    "client_name": "Иван Иванов",
    "client_phone": "87071234567",
    "is_sandbox": false,
    "is_qr_token": false,
    "paid_at": "2026-02-12T14:35:00+05:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:35:01+05:00"
}
```

> **Примечание:** Поля `subtotal`, `discount_sum` и `discount_percentage` появляются только при наличии скидки в счёте. Поле `is_sandbox` показывает, был ли ресурс создан в sandbox-режиме. Поле `is_qr_token` равно `true`, если счёт создан через QR-эндпоинт (`POST /invoices/qr`).

### invoice.refunded

Отправляется при возврате по счёту (полном или частичном).

```json
{
  "event": "invoice.refunded",
  "refund": {
    "id": 5,
    "amount": "2000.00",
    "status": "completed",
    "reason": "Возврат товара",
    "created_at": "2026-02-12T10:00:00+05:00"
  },
  "invoice": {
    "id": 42,
    "external_order_id": "order_123",
    "amount": "5000.00",
    "subtotal": "5500.00",
    "discount_sum": "500.00",
    "total_refunded": "2000.00",
    "available_for_refund": "3000.00",
    "is_fully_refunded": false,
    "is_sandbox": false,
    "status": "paid",
    "kaspi_invoice_id": "13234689513"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T10:00:01+05:00"
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

Все события вебхуков — и по счетам, и по подпискам — повторяются при неудачной доставке.

- **До 11 попыток доставки:** 1 первая доставка + 10 повторов
- **Экспоненциальные интервалы:** 10с, 30с, 1м, 1.5м, 2м, 5м, 10м, 15м, 30м, 1ч — всего около 2 часов
- **Успех:** доставка считается успешной только при HTTP-ответе 2xx; любой другой статус (или таймаут) запускает повтор

## Требования к ответу

1. Возвращайте статус **2xx** в течение **5 секунд** (таймаут доставки: 5с на ответ плюс до 3с на установление соединения)
2. Будьте **идемпотентны** — корректно обрабатывайте повторные доставки

## Лучшие практики безопасности

1. **Всегда проверяйте подпись**
2. **Используйте HTTPS** в production
3. **Храните secrets в переменных окружения**
4. **Используйте ключи идемпотентности** — `invoice.id` + `status`
