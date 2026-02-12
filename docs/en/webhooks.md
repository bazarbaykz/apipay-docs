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
    "status": "paid",
    "description": "Order payment",
    "client_name": "John Doe",
    "paid_at": "2025-12-25T14:35:00Z"
  },
  "source": "api",
  "timestamp": "2025-12-25T14:35:01Z"
}
```

### invoice.refunded

Sent when an invoice is refunded (fully or partially).

```json
{
  "event": "invoice.refunded",
  "invoice": {
    "id": 42,
    "amount": "15000.00",
    "status": "partially_refunded",
    "total_refunded": "5000.00",
    "external_order_id": "order_123"
  },
  "source": "api",
  "timestamp": "2025-12-25T15:00:00Z"
}
```

### subscription.payment_succeeded

Sent when a subscription payment succeeds.

```json
{
  "event": "subscription.payment_succeeded",
  "data": {
    "subscription": {
      "id": 1,
      "status": "active",
      "billing_period": "monthly"
    },
    "invoice": {
      "id": 100,
      "amount": "5000.00",
      "status": "paid"
    }
  },
  "source": "subscription",
  "timestamp": "2025-02-01T00:01:00Z"
}
```

### subscription.payment_failed

Sent when a subscription payment fails.

```json
{
  "event": "subscription.payment_failed",
  "data": {
    "subscription": {
      "id": 1,
      "status": "active"
    },
    "reason": "Payment declined"
  },
  "source": "subscription",
  "timestamp": "2025-02-01T00:01:00Z"
}
```

### subscription.grace_period_started

Sent when a subscription enters the grace period after payment failure.

```json
{
  "event": "subscription.grace_period_started",
  "data": {
    "subscription": {
      "id": 1,
      "grace_period_days": 7,
      "retry_attempts_remaining": 3
    }
  },
  "source": "subscription",
  "timestamp": "2025-02-01T00:02:00Z"
}
```

### subscription.expired

Sent when a subscription expires after all retries fail.

```json
{
  "event": "subscription.expired",
  "data": {
    "subscription": {
      "id": 1,
      "status": "expired"
    }
  },
  "source": "subscription",
  "timestamp": "2025-02-08T00:01:00Z"
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

- **Invoice webhooks** — Not retried
- **Subscription webhooks** — Retried up to 3 times at 1, 5, and 15 minute intervals

## Response Requirements

1. Return **2xx status** within 30 seconds
2. Be **idempotent** — handle duplicate deliveries

## Security Best Practices

1. **Always verify signatures**
2. **Use HTTPS** in production
3. **Store secrets in environment variables**
4. **Use idempotency keys** — `invoice.id` + `status`
