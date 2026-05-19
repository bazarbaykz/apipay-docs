# Webhooks

Webhooks deliver real-time notifications when payment events occur.

## Configuration

Configure webhooks in [ApiPay.kz Dashboard](https://apipay.kz) → Settings → Connection:

1. Click **Add Webhook**
2. Enter your webhook URL
3. Save and copy the **secret** (shown only once!)

## Events

### invoice.status_changed

Sent when an invoice status changes (paid, cancelled, expired).

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
    "description": "Order payment",
    "kaspi_invoice_id": "13234689513",
    "client_name": "John Doe",
    "client_phone": "87071234567",
    "is_sandbox": false,
    "is_qr_token": false,
    "paid_at": "2026-02-12T14:35:00+05:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:35:01+05:00"
}
```

> **Note:** Fields `subtotal`, `discount_sum`, and `discount_percentage` appear only when the invoice has discounts applied. The `is_sandbox` field indicates whether the resource was created in sandbox mode. The `is_qr_token` field is `true` when the invoice was created via the QR endpoint (`POST /invoices/qr`).

### invoice.refunded

Sent when an invoice is refunded (fully or partially).

```json
{
  "event": "invoice.refunded",
  "refund": {
    "id": 5,
    "amount": "2000.00",
    "status": "completed",
    "reason": "Product return",
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

Sent when a subscription payment succeeds.

```json
{
  "event": "subscription.payment_succeeded",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Ivan Ivanov",
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

Sent when a subscription payment fails.

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

Sent when a subscription enters the grace period after payment failure.

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

Sent when a subscription expires after all retries fail.

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

Sent when you test a webhook from the dashboard.

```json
{
  "event": "webhook.test",
  "source": "test",
  "timestamp": "2026-01-15T10:00:00Z"
}
```

## Signature Verification

Every request includes `X-Webhook-Signature: sha256=<HMAC-SHA256>`.

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

## Retry Policy

All webhook events — both invoice and subscription — are retried on delivery failure.

- **Up to 11 delivery attempts:** 1 initial delivery + 10 retries
- **Exponential backoff intervals:** 10s, 30s, 1m, 1.5m, 2m, 5m, 10m, 15m, 30m, 1h — about 2 hours total
- **Success:** a delivery counts as successful only on an HTTP 2xx response; any other status (or a timeout) triggers a retry

## Response Requirements

1. Return a **2xx status** within **5 seconds** (delivery timeout: 5s for the response plus up to 3s to establish the connection)
2. Be **idempotent** — handle duplicate deliveries

## Security Best Practices

1. **Always verify signatures**
2. **Use HTTPS** in production
3. **Store secrets in environment variables**
4. **Use idempotency keys** — `invoice.id` + `status`
