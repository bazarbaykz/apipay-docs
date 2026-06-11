# Webhooks

Webhooks deliver real-time notifications when payment events occur.

## Configuration

Configure webhooks in [ApiPay.kz Dashboard](https://apipay.kz) → Settings → Connection:

1. Click **Add Webhook**
2. Enter your webhook URL
3. Save and copy the **secret** (shown only once!)

> **All dates in webhooks are in UTC** (ISO 8601, `+00:00`).

## Events

ApiPay sends 11 event types:

| Event | Description |
|-------|-------------|
| `invoice.status_changed` | An invoice status changed |
| `invoice.refunded` | A refund on an invoice succeeded (or failed) |
| `subscription.created` | A subscription was created |
| `subscription.payment_succeeded` | A subscription invoice was paid |
| `subscription.payment_failed` | A subscription invoice was not paid |
| `subscription.grace_period_started` | The subscription entered the grace period |
| `subscription.expired` | The subscription expired |
| `subscription.paused` | The subscription was paused |
| `subscription.resumed` | The subscription was resumed |
| `subscription.cancelled` | The subscription was cancelled |
| `webhook.test` | Test event from the dashboard |

### invoice.status_changed

Sent when an invoice status changes.

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
    "kaspi_source_type": "GOLD",
    "kaspi_sale_type": "Remote",
    "paid_at": "2026-02-12T14:35:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:35:01+00:00"
}
```

> **Note:** Fields `subtotal`, `discount_sum`, and `discount_percentage` appear only when the invoice has discounts applied. The `is_sandbox` field indicates whether the resource was created in sandbox mode. Fields `kaspi_source_type` and `kaspi_sale_type` are gated by Kaspi returning a value (treat them as nullable).

#### Invoice not processed (status: error)

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 43,
    "external_order_id": "order_124",
    "amount": "15000.00",
    "status": "error",
    "description": "Order payment",
    "kaspi_invoice_id": null,
    "client_name": null,
    "client_phone": "87071234567",
    "is_sandbox": false,
    "errored_at": "2026-02-12T14:40:00+00:00",
    "error_message": "This phone number is not registered in Kaspi. Provide a number with the Kaspi app installed.",
    "error_code": "client_not_found"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:40:01+00:00"
}
```

#### Invoice expired (status: expired)

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 46,
    "external_order_id": "order_125",
    "amount": "15000.00",
    "status": "expired",
    "description": "Order payment",
    "kaspi_invoice_id": "13234689515",
    "client_name": "John Doe",
    "client_phone": "87071234567",
    "is_sandbox": false,
    "expired_at": "2026-02-13T14:35:00+00:00"
  },
  "source": "My API Key",
  "timestamp": "2026-02-13T14:35:01+00:00"
}
```

#### QR invoice superseded (status: cancelled)

```json
{
  "event": "invoice.status_changed",
  "invoice": {
    "id": 44,
    "external_order_id": null,
    "amount": "15000.00",
    "status": "cancelled",
    "description": "QR at the till",
    "kaspi_invoice_id": "13234689514",
    "client_name": null,
    "client_phone": "87071234567",
    "is_sandbox": false,
    "cancelled_at": "2026-02-12T14:45:00+00:00",
    "error_message": "Superseded by new QR invoice #45"
  },
  "source": "My API Key",
  "timestamp": "2026-02-12T14:45:01+00:00"
}
```

**Payload fields**

| Field | Type | Description |
|-------|------|-------------|
| `invoice.status` | string | Invoice status: `pending` / `paid` / `cancelled` / `expired` / `error` / `partially_refunded`. There is no `refunded` status — a full refund keeps `paid` + `is_fully_refunded=true`. |
| `invoice.kaspi_invoice_id` | string \| null | Invoice ID in Kaspi. Appears already at `pending` (once the invoice is created in Kaspi); `null` until the invoice reaches Kaspi. |
| `invoice.paid_at` | string \| null | Payment time (ISO 8601). The field is **absent** in every status except `paid` (not `null` before payment). |
| `invoice.cancelled_at` / `expired_at` / `errored_at` | string \| null | Time of the transition into the matching status (ISO 8601). Present only for that status. |
| `invoice.error_message` | string \| null | Human-readable reason. Always present at `status=error`; at `status=cancelled` only when filled (e.g. "Superseded by new QR invoice #N"). Absent in `paid`/`pending`/`expired`. |
| `invoice.error_code` | string \| null | Stable snake_case code from the catalog (see [Error Codes](errors.md)). Present only when not `null` and only at `status=error`/`cancelled`. Build your logic on it, not on the text. |
| `invoice.subtotal` / `discount_sum` / `discount_percentage` | string \| null | Only for invoices with a cart/discount (`subtotal` and `discount_sum` come together). |
| `invoice.kaspi_source_type` | string \| null | Customer funding source: `GOLD`, `RED`, `LOAN`, `BUSINESSACCOUNT`, `BANKINTEGRATIONACCOUNT`. Gated by Kaspi returning a value; the list may grow. |
| `invoice.kaspi_sale_type` | string \| null | How the invoice was accepted: `Remote`, `QR`, `Restaurant`, `Static`. Gated by Kaspi returning a value; the list may grow. |

### invoice.refunded

Sent when an invoice refund either succeeds (`completed`) or fails (`failed`).

```json
{
  "event": "invoice.refunded",
  "refund": {
    "id": 5,
    "amount": "2000.00",
    "status": "completed",
    "kaspi_refund_id": "1126827352",
    "reason": "Product return",
    "created_at": "2026-02-12T10:00:00+00:00",
    "items": [
      {"catalog_item_id": 12, "name": "Coffee", "price": "1000.00", "count": 2, "amount": "2000.00"}
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

#### Refund failed (refund.status: failed)

```json
{
  "event": "invoice.refunded",
  "refund": {
    "id": 6,
    "amount": "2000.00",
    "status": "failed",
    "kaspi_refund_id": null,
    "reason": "Product return",
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

**Payload fields**

| Field | Type | Description |
|-------|------|-------------|
| `refund.status` | string | `pending` / `processing` / `completed` / `failed`. The webhook arrives on both `completed` and `failed`. |
| `refund.kaspi_refund_id` | string \| null | Refund ID in Kaspi; `null` on failure. |
| `refund.error_code` | string \| null | Only at `status=failed`. For example `refund_window_expired` — the refund window expired (~14 days). There is no `error_message` in the webhook by design — read the text in `GET /invoices/{id}/refunds` or resolve the code via the catalog. |
| `refund.items` | array \| null | Refund line items (only for itemized refunds): `catalog_item_id`, `name`, `price`, `count`, `amount`. |
| `invoice.available_for_refund` | number | Amount still available for refund. Comes as a number (float), unlike `amount` and `total_refunded` (strings). |
| `invoice.status` | string | Invoice status after the refund. A full refund does **not** change the status (stays `paid` — or `partially_refunded` if there was an earlier partial one) + `is_fully_refunded=true`; the first partial refund moves it to `partially_refunded` (and an `invoice.status_changed` is also sent). |

### subscription.created

Sent when a subscription is created.

```json
{
  "event": "subscription.created",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Ivan Ivanov",
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

The first invoice is issued at `next_billing_at` (or immediately, if `bill_immediately` was passed at creation).

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
  "timestamp": "2026-02-02T12:00:01+00:00"
}
```

> While `attempt_number` is below `max_retry_attempts` (3 by default), the system **re-issues** the period invoice itself, at the `retry_interval_hours` interval (24h by default). You don't need to recreate anything — just notify the customer (`attempt_number`, `reason`). A subscription invoice that ends in `error` (e.g. `client_not_found`) does **not** count as a payment failure — this event won't fire; watch the invoice `error` webhook instead.

### subscription.grace_period_started

Sent when a subscription enters the grace period after the retries are exhausted.

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

The subscription stays active for `grace_period_days` (3 by default). Any successful payment lifts the grace period.

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
  "timestamp": "2026-02-05T12:00:01+00:00"
}
```

Billing is stopped for good, with no reactivation. To resume, create a new subscription.

### subscription.paused

Sent when a subscription is paused (`POST /subscriptions/{id}/pause`).

```json
{
  "event": "subscription.paused",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Ivan Ivanov",
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

No invoices are issued until the subscription is resumed.

### subscription.resumed

Sent when a subscription is resumed.

```json
{
  "event": "subscription.resumed",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Ivan Ivanov",
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

`next_billing_at` is recalculated from the moment of resumption — missed periods are not back-charged.

### subscription.cancelled

Sent when a subscription is cancelled.

```json
{
  "event": "subscription.cancelled",
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Ivan Ivanov",
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

The subscription is cancelled irreversibly: `next_billing_at` keeps its last value, and no invoices are issued anymore. To resume, create a new subscription.

### webhook.test

Sent when you test a webhook from the dashboard (Settings → API Keys → Test webhook). A dummy invoice with `status=test` — your receiver should simply ignore it.

```json
{
  "event": "webhook.test",
  "source": "test",
  "timestamp": "2026-01-15T10:00:00Z"
}
```

## When a webhook arrives

This section lists the events that make ApiPay send a webhook, and in which status it arrives. The technical statuses `processing`/`cancelling` produce **no** webhook.

| Event | Status | When it arrives |
|-------|--------|-----------------|
| `invoice.status_changed` | `pending` | The invoice was created in Kaspi and awaits payment. For phone invoices (`POST /invoices`) this is the first webhook after the 201 response with `status=processing`. For QR invoices (`POST /invoices/qr`) the `pending` webhook is **not** sent — the status is returned synchronously in the 201 response; the first webhook for a QR invoice is payment, cancellation, expiry, or error. |
| `invoice.status_changed` | `paid` | The invoice was paid. May arrive even **after** `cancelled`/`expired` — a last-second payment wins the race (see "Status transitions"). |
| `invoice.status_changed` | `cancelled` | The invoice was cancelled: by you via the API, by the cashier, or automatically — when the same till creates a new QR (`error_message`: "Superseded by new QR invoice #N"). |
| `invoice.status_changed` | `expired` | The invoice expired: 24 hours in Kaspi, or ~5 minutes for a QR token. |
| `invoice.status_changed` | `error` | A technical error — the invoice is finalized, the system no longer retries it. The reason is in `error_code`/`error_message` (see "Response scenarios"). |
| `invoice.status_changed` | `partially_refunded` | The first partial refund on the invoice (in addition to `invoice.refunded`). Subsequent partial refunds don't change the status. |
| `invoice.refunded` | `completed` | The refund went through. Includes refunds made by the cashier in the Kaspi app (imported automatically). |
| `invoice.refunded` | `failed` | The refund failed (`refund.error_code`). The system does **not** retry; the amount is not locked — you can create a new refund. |
| `subscription.created` | — | The subscription was created. The system issues subscription invoices automatically at `next_billing_at` (or immediately with `bill_immediately`). Each invoice triggers the regular invoice webhooks. |
| `subscription.payment_succeeded` | — | The next subscription invoice was paid. `failed_attempts` is reset; the grace period (if any) is lifted. |
| `subscription.payment_failed` | — | The subscription invoice expired or was cancelled (`reason`). While attempts are below `max_retry_attempts` the system re-issues the invoice itself — nothing to recreate. |
| `subscription.grace_period_started` | — | All retries are exhausted; the subscription stays active for `grace_period_days`. Any successful payment lifts the grace period. |
| `subscription.expired` | — | The grace period ended — billing is stopped for good. To resume, create a new subscription. |
| `subscription.paused` | — | The subscription was paused. No invoices are issued. |
| `subscription.resumed` | — | The subscription was resumed; `next_billing_at` is recalculated from the moment of resumption. |
| `subscription.cancelled` | — | The subscription was cancelled irreversibly. |
| `webhook.test` | — | A manual test from the dashboard. A dummy invoice with `status=test` — just ignore it. |

## Status transitions

Guarantee: exactly **one** webhook per real status transition. Consecutive duplicates of the same status, the technical `processing`/`cancelling`, a stale `pending` after a terminal status, and `error` after `paid` are all suppressed. That said, a re-delivery of the same transition is possible (retries after a partial delivery) — deduplicate by `(invoice.id, status)` and `(refund.id, status)`. Respond `200 OK` quickly (≤5 seconds) and process asynchronously.

**Allowed transitions:**

| From | To | Comment |
|------|----|---------|
| `pending` | `paid` / `cancelled` / `expired` / `error` | the normal lifecycle |
| `cancelled` / `expired` | `paid` | a last-second payment wins the race — handle it as "money received": ship the order or issue a refund. This is not a bug. |
| `error` | `pending` | reconciliation: the invoice actually did get created in Kaspi — follow the latest status |
| `paid` | `partially_refunded` | the first partial refund |

**Never happen:**

| Transition | Comment |
|------------|---------|
| terminal → `pending` | except `error → pending` (reconciliation) |
| `paid → error` | suppressed as an incident |
| `error → paid` | impossible |

**No webhook:** a 202 response to a cancellation moves the invoice to `cancelling` **without** a webhook; if Kaspi refuses the cancellation (usually the invoice is already paid) the invoice quietly returns to `pending`, and the real status (usually `paid`) is delivered by sync within minutes. After a 202, don't treat the invoice as cancelled — wait for the webhook.

## Response scenarios

When a webhook brings `status=error` (invoice) or `status=failed` (refund), the operation is finalized: the system has already exhausted its own retries and will **not** repeat it. "Retry" always means "create a new operation". While an invoice is in `processing`, the system retries on its own and you should not intervene (a legitimate backlog can keep an invoice in `processing` for over an hour under Kaspi throttling).

| Error code | What happened | What the system does | What you should do |
|-----------|---------------|----------------------|--------------------|
| `client_not_found` | The phone number is not registered in Kaspi | Finalizes the invoice immediately, no retries | Ask the customer for another number and create a new invoice |
| `network_unavailable` | The network/Kaspi was unavailable | Retried on its own; the webhook means retries are exhausted | Create a new invoice/refund in 1–2 minutes |
| `session_transient` | A transient cashier session glitch | Invalidated the session automatically and retried | Create a new invoice later; if it recurs — reconnect the cashier in the dashboard |
| `kaspi_throttled` | Kaspi rate-limited the till's requests | Automatically slows that till's queue (up to 3 minutes per invoice) and retries; the webhook = finalization | While the invoice is in `processing` — nothing. After `error` — a new invoice in 2–3 minutes; reduce your invoice creation rate |
| `organization_not_configured` | No Kaspi cashier is connected to the organization | Finalizes immediately | Connect a cashier: dashboard → Settings → Kaspi Authorization |
| `invoice_already_paid` | An attempt to cancel an already-paid invoice | Stopped the cancellation; the money is received | Don't cancel; to return the money, create a refund |
| `invoice_already_cancelled` | The invoice is already cancelled | — | Nothing: the desired state is already reached |
| `invoice_not_found_in_kaspi` | Kaspi could not find the invoice during cancellation | Finalizes `error` | Contact support |
| `refund_window_expired` | The refund window expired (~14 days) or the refund was already made | Refund `failed`, no retries | Don't repeat; notify the customer or contact support |
| `qr_render_failed` | The QR image could not be rendered | The invoice is finalized in `error` (both a 500 response and a webhook) | Retry `POST /invoices/qr` — a new invoice is created |
| `kaspi_session_invalid` | The cashier session expired while creating the QR | The invoice is finalized in `error`; the session is invalidated | Retry later; if it recurs — reconnect the cashier |
| `kaspi_error` | An unclassified Kaspi error | Depends on the cause; for QR — invoice `error` + webhook | Read `message`/`error_message`; retry or contact support |
| `unknown_error` | An unexpected error (including all creation attempts exhausted) | Finalized after all retries | Create a new invoice; if it recurs — support |

**Scenarios without an `error_code`:**

- **QR superseded** — a `cancelled` webhook with `error_message` "Superseded by new QR invoice #N" (no `error_code`). Kaspi keeps one active QR per till — this is expected. Use the new QR.
- **Invoice expired** — an `expired` webhook (24h, QR ~5 min). Create a new invoice if needed.
- **Payment after cancellation/expiry** — a `paid` webhook after `cancelled`/`expired`: the money is received — ship the order or issue a refund.
- **Back to `pending` after `error`** — a corrective `pending` webhook (reconciliation). Follow the latest status.

## Signature Verification

Every request includes `X-Webhook-Signature: sha256=<HMAC-SHA256>` — an HMAC-SHA256 over the raw request body. The header is absent if the key has no webhook secret configured.

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

## Delivery

All webhook events — both invoice and subscription — are retried on delivery failure.

- **Up to 11 attempts:** 1 initial delivery + 10 retries
- **Exponential backoff intervals:** 10s, 30s, 1m, 1.5m, 2m, 5m, 10m, 15m, 30m, 1h — about 2 hours total
- **Sandbox:** in sandbox mode, invoice webhooks are delivered in just **3 attempts** (intervals 5s, 15s). Refund and subscription webhooks always use the full 11 attempts — no sandbox shortcut for them
- **Success:** a delivery counts as successful only on an HTTP **2xx** response
- **3xx/4xx:** only HTTP ≥500, exactly 429, and network errors are retried. 3xx and 4xx responses (except 429) are **not** retried — the attempt is recorded as delivered immediately. You can only re-send such a delivery manually: dashboard → Webhook logs → Retry (for entries with `status=failed`, 10-second cooldown between manual retries)
- **All dates in webhooks are in UTC** (ISO 8601, `+00:00`)

### Circuit breaker

If your endpoint is consistently unavailable, delivery to the key is paused:

- 5 consecutive failures → pause 5 minutes
- 10 → pause 30 minutes
- 20 → pause 2 hours
- 50 → full shutdown until manual intervention

Webhooks during the pause are **not** re-sent — reconcile state via the GET methods. Any successful delivery (or a successful test webhook from the dashboard) resets the counter. The status is visible in the API keys list.

> `subscription.*` events are not written to the dashboard Webhook logs: there is no manual retry or circuit breaker for them (a known limitation).

## Response Requirements

1. Return a **2xx status** within **5 seconds** (delivery timeout: 5s for the response plus up to 3s to establish the connection)
2. Be **idempotent** — handle duplicate deliveries

### Deduplication

Client-side deduplication is **mandatory**: a retry after a partial delivery to multiple receivers re-sends the webhook to all of them. Deduplication keys:

- `(invoice.id, invoice.status)` — for invoice events
- `(refund.id, refund.status)` — for refunds
- `(event, subscription.id, invoice_id)` — for subscription events

## Security Best Practices

1. **Always verify signatures**
2. **Use HTTPS** in production
3. **Store secrets in environment variables**
4. **Use idempotency keys** (see "Deduplication")
