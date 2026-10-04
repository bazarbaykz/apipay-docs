# Subscriptions

Subscriptions automatically issue Kaspi invoices on a schedule — for memberships, SaaS, and regular services.

There is no auto-debit: on each billing date the system creates a regular Kaspi invoice, and the customer confirms the payment in the Kaspi app. If an invoice is not paid, the system re-issues it automatically — how many times depends on the `bill_until_paid` mode, see [Grace Period](#grace-period).

## Create Subscription

**Endpoint:** `POST /subscriptions`

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "phone_number": "87001234567",
    "subscriber_name": "John Doe",
    "description": "Monthly subscription",
    "billing_period": "monthly",
    "billing_day": 1
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Conditional | Amount in KZT (100 - 1,000,000), **whole tenge only**. Not required when `cart_items` provided |
| `phone_number` | string | Yes | Customer phone (format: 8XXXXXXXXXX) |
| `billing_period` | string | Yes | Billing cycle (see table below) |
| `billing_day` | integer | No | Day of charge. For `monthly`, `quarterly`, `yearly` — day of month (1–28). For `weekly` and `biweekly` — **day of week**: 1 = Monday … 7 = Sunday; a value above 7 on these periods returns a `422`. Not used for `daily`. Mutually exclusive with `billing_day_from_end` |
| `billing_day_from_end` | integer | No | Anchor from the end of the month: `0` — the last day, `1` — the day before. Only for `monthly`, `quarterly`, `yearly`. Mutually exclusive with `billing_day` |
| `billing_time` | string | No | Charge time in Almaty as `HH:MM`, within a 06:00–22:00 window. Defaults to `13:00` |
| `first_billing_at` | string | No | Date of the first charge (YYYY-MM-DD, Almaty calendar). Without it the first charge is `started_at` plus one period. The date cannot be in the past or more than two years ahead, and together with `bill_immediately` it returns a `422`. Can only be set at creation |
| `total_cycles` | integer | No | How many **paid** charges to make over the whole life of the subscription (1–600). Empty means open-ended. An unpaid attempt does not consume a cycle; once the limit is reached the subscription moves to `expired` |
| `description` | string | No | Payment description (max 60 chars — Kaspi shows the buyer only the first 60). Without it the charge invoice goes out with the text «Оплата подписки №{id}», or «Оплата подписки №{id} (песочница)» in the sandbox |
| `subscriber_name` | string | No | Subscriber name (max 255 chars) |
| `external_subscriber_id` | string | No | Your external subscriber ID (max 255 chars) |
| `started_at` | string | No | Start date (YYYY-MM-DD, default: today) |
| `max_retry_attempts` | integer | No | How many invoices to issue per period on non-payment (1-10). Together with `bill_until_paid: true` returns `422` |
| `retry_interval_hours` | integer | No | Hours between retries (1-168) |
| `grace_period_days` | integer | No | Grace period in days (1-30) |
| `metadata` | object | No | Custom JSON data |
| `cart_items` | array | Conditional | Cart items `[{ catalog_item_id, count }]`, 1–100 items. **Required** for catalog organizations — the amount is computed server-side and `amount` is ignored. Non-catalog organizations must **not** send it: the request returns `422` |
| `bill_immediately` | boolean | No | If `true` — first invoice is created immediately. Default: `false` (first invoice on schedule) |
| `bill_until_paid` | boolean | No | “Keep invoicing until paid” mode: the subscription does not expire for non-payment. Default: `false` — the previous behaviour with `max_retry_attempts`. See [Grace Period](#grace-period) |

> ⚠️ **An item being taken off sale behaves differently at creation and at charge time.** You cannot create or update a subscription with an item in the `deleting` status — that returns `422`, with the reason in `errors["cart_items.N.catalog_item_id"]`. A scheduled charge on an already running subscription, however, does not fail but is moved to the next charge attempt: the failure counter does not grow and the subscription does not enter the grace period because of a temporary state. Bring the item back with a regular `POST /catalog` — see [Catalog → Item Statuses](catalog.md#item-statuses). A postponed charge is not signalled in any way: no invoice for the period is created, no webhook is sent and `next_billing_at` does not move — bring the item back yourself if you need the money sooner.

> ⛔ **The charged amount must be whole tenge.** A subscription charge is issued as a phone-number invoice, so a fractional amount (either `amount` or the `cart_items` total after discounts) lands in the `error` status with `error_code: amount_must_be_whole_tenge` — on **every** charge. Subscription creation does not reject it: check the amounts of your active subscriptions and the prices of catalog items.

### Billing Periods

| Period | Description |
|--------|-------------|
| `daily` | Every day |
| `weekly` | Weekly, on the `billing_day` weekday; without it — every 7 days from the previous charge |
| `biweekly` | Every two weeks, on the same weekday; without `billing_day` — every 14 days |
| `monthly` | Same day each month |
| `quarterly` | Every 3 months |
| `yearly` | Same day each year |

### Response

```json
{
  "message": "Subscription created",
  "subscription": {
    "id": 1,
    "amount": "5000.00",
    "phone_number": "87001234567",
    "subscriber_name": "John Doe",
    "description": "Monthly subscription",
    "billing_period": "monthly",
    "billing_day": 1,
    "billing_day_from_end": null,
    "billing_time": "13:00",
    "total_cycles": null,
    "cycles_paid": 0,
    "status": "active",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "next_billing_in_days": 28,
    "next_billing_label": "in 28 days",
    "created_at": "2026-02-01T12:00:00+00:00"
  }
}
```

`next_billing_at` is returned in UTC and carries a time of day: `08:00+00:00` is 13:00 in Almaty.
`next_billing_in_days` is a **signed** number of days in the Almaty calendar: a negative value
means overdue. If you compare this field with zero, take the sign into account.

The HTTP status is `201`. The subscription itself is in the `subscription` field; `PUT /subscriptions/{id}`, `pause`, `resume` and `cancel` are shaped the same way.

## List Subscriptions

**Endpoint:** `GET /subscriptions`

```bash
curl "https://api.apipay.kz/api/v1/subscriptions?status=active&page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (default: 20, maximum 100 — a larger value is clamped to 100) |
| `status` | string | Filter: `active`, `paused`, `cancelled`, `expired` |
| `phone_number` | string | Filter by phone |
| `external_subscriber_id` | string | Filter by your subscriber ID |

> No other filters or sorting are available on this endpoint: the list is always returned newest-first (`created_at DESC`).

## Get Subscription

**Endpoint:** `GET /subscriptions/{id}`

Returns the subscription with its stats and last payment. The response body is `{ "subscription": { … } }`: the subscription itself and the nested `stats` / `last_payment` all sit inside the `subscription` field.

```bash
curl https://api.apipay.kz/api/v1/subscriptions/1 \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response

```json
{
  "subscription": {
    "id": 1,
    "amount": "5000.00",
    "phone_number": "87001234567",
    "subscriber_name": "John Doe",
    "billing_period": "monthly",
    "billing_day": 1,
    "status": "active",
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "stats": {
      "total_payments": 5,
      "successful_payments": 5,
      "failed_payments": 0,
      "total_collected": "25000.00"
    },
    "last_payment": {
      "amount": "5000.00",
      "status": "paid",
      "paid_at": "2026-02-01T10:30:00+00:00"
    },
    "created_at": "2026-01-01T12:00:00+00:00"
  }
}
```

### stats Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_payments` | integer | Total payments |
| `successful_payments` | integer | Successful payments |
| `failed_payments` | integer | Failed payments |
| `total_collected` | string | Total amount collected |

Skipped periods (`status: skipped` in the payment history) are not counted in `stats` — they are not payment attempts.

### last_payment Field

| Field | Type | Description |
|-------|------|-------------|
| `amount` | string | Payment amount |
| `status` | string | Status |
| `paid_at` | string | Payment date (ISO 8601) |

## Update Subscription

**Endpoint:** `PUT /subscriptions/{id}`

```bash
curl -X PUT https://api.apipay.kz/api/v1/subscriptions/1 \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 7500, "description": "Premium monthly"}'
```

Updatable fields: `amount`, `billing_day`, `billing_day_from_end`, `billing_time`, `total_cycles`, `description`, `subscriber_name`, `max_retry_attempts`, `retry_interval_hours`, `grace_period_days`, `bill_until_paid`, `metadata`, `cart_items`. The first charge date `first_billing_at` can only be set at creation.

> ⚠️ **A subscription description follows the same rule as an invoice description.** A changed description
> longer than 60 characters returns a `422`.
> Only a **changed** description is validated: editing other fields on a
> subscription that already has a long description works as before.

## Pause Subscription

**Endpoint:** `POST /subscriptions/{id}/pause`

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/pause \
  -H "X-API-Key: YOUR_API_KEY"
```

## Resume Subscription

**Endpoint:** `POST /subscriptions/{id}/resume`

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/resume \
  -H "X-API-Key: YOUR_API_KEY"
```

Resumes a `paused` or `expired` subscription with its own billing period: `billing_period` and the schedule are kept, `next_billing_at` is recalculated from the moment of resumption, and missed periods are not charged retroactively. For an expired subscription the failed-attempt counter is reset. A subscription that has received all `total_cycles` payments cannot be resumed — create a new one.

## Skip a Period

Closes a subscription period without payment — for example, when the buyer paid you another way. The subscription stays active: failed attempts and the grace period are reset, and the next period is invoiced on schedule. A period can only be skipped for a subscription in `active` status, including during retries and in the grace period. The same action is available in the ApiPay dashboard.

Skipping takes two steps: first the preview, then the action.

### Preview

**Endpoint:** `POST /subscriptions/{id}/skip-period/preview`

Changes nothing and shows which period will be skipped, whether cancellation of its invoice will be requested, and when the next invoice will arrive.

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/skip-period/preview \
  -H "X-API-Key: YOUR_API_KEY"
```

```json
{
  "skip": {
    "kind": "live_invoice",
    "billing_period_start": "2026-03-01",
    "billing_period_end": "2026-03-31",
    "invoice": { "id": 202, "amount": "5000.00", "status": "pending" },
    "next_billing_at": "2026-04-01T08:00:00+00:00",
    "next_billing_label": "in 30 days",
    "next_billing_in_days": 30,
    "resets_retries": false
  }
}
```

| Field | Description |
|-------|-------------|
| `kind` | `live_invoice` — the period's invoice has already been issued, and the skip will request its cancellation in Kaspi; `open_retry` — the period is unpaid and still open (retries or the grace period are under way); `next_period` — the nearest period, for which no invoice has been issued yet |
| `billing_period_start`, `billing_period_end` | Boundaries of the period being skipped (YYYY-MM-DD) |
| `invoice` | The period's invoice whose cancellation the skip will request: `id`, `amount`, `status`. `null` if there is nothing to cancel |
| `next_billing_at` | When the next period's invoice will arrive; `next_billing_label` and `next_billing_in_days` are the same for display. It can be in the past: then the current period's invoice is issued without waiting for the next date |
| `resets_retries` | `true` — the skip will clear failed attempts or the grace period |

### Action

**Endpoint:** `POST /subscriptions/{id}/skip-period`

Pass `billing_period_start` from the preview — that way exactly the period you showed the person is skipped. The field is required: without it you get `422`.

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/skip-period \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"billing_period_start": "2026-03-01"}'
```

The response is `200` with `message`, `subscription` and `skip`. `skip` has the same shape as in the preview, plus `replayed`.

Repeating the request with the same `billing_period_start` is safe: a second period is not skipped, and the response comes with `skip.replayed: true`. So after a dropped connection you can simply repeat the request. With `replayed: true`, `kind` and `invoice` describe the current state of that period rather than what the preview showed.

### Refusals

The refusal code comes in the `error` and `error_code` fields. Of these refusals, the preview returns only `subscription_not_active`, `subscription_cycles_exhausted` and `tariff_inactive`.

| Code | HTTP | What to do |
|------|------|------------|
| `skip_period_changed` | 409 | The period changed while the person was confirming the skip (for example, a new invoice was issued). The body carries a fresh `skip`: show it to the person and repeat with the new `billing_period_start`. Do not retry blindly |
| `subscription_busy` | 409 | An invoice is being issued for this subscription right now; nothing was changed. Retry in about a minute with the same `billing_period_start` |
| `subscription_not_active` | 409 | The subscription is not in `active` status (paused, cancelled or expired) — there is nothing to skip |
| `subscription_cycles_exhausted` | 409 | All `total_cycles` payments have been received — there is nothing to skip |
| `tariff_inactive` | 403 | The ApiPay tariff is not paid. Renew the tariff in the dashboard |

### What happens to the period's invoice

If the period's invoice has already been issued (`kind: live_invoice`), ApiPay sends its cancellation to Kaspi — the same way as `POST /invoices/{id}/cancel`. The outcome arrives in an `invoice.status_changed` webhook (`cancelled` or `error`). Kaspi may not accept the cancellation: then the invoice returns to `pending` without a separate webhook and stays available to the buyer. No `subscription.payment_failed` is sent for that invoice.

If the buyer still pays that invoice — before the cancellation or after Kaspi refused it — the period counts as paid. The payment-history row becomes `paid`, and `subscription.payment_succeeded` arrives with `invoice_id` equal to `cancelled_invoice_id` from `subscription.period_skipped`. The events may arrive in any order — the period ends up `paid`.

If the buyer has already settled with you another way, refund the extra payment yourself via `POST /invoices/{id}/refund`.

### Payment history and webhook

In the payment history (`GET /subscriptions/{id}/invoices`) a skipped period has status `skipped`. It is not a debt. If no invoice had been issued for the period, the row has no invoice: `invoice_id` and `amount` are `null`, and there is no `invoice` field. Skips are not counted in the subscription's `stats`.

A skip does not count as a payment: a subscription with `total_cycles` runs one period longer.

A skip triggers the `subscription.period_skipped` webhook — both when the period is skipped via the API and when it is skipped in the dashboard. The payload root carries `billing_period_start`, `billing_period_end` and `cancelled_invoice_id`. See [Webhooks](webhooks.md).

## Cancel Subscription

**Endpoint:** `POST /subscriptions/{id}/cancel`

Permanently cancels. Cannot be resumed.

```bash
curl -X POST https://api.apipay.kz/api/v1/subscriptions/1/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

## Subscription Invoices

**Endpoint:** `GET /subscriptions/{id}/invoices`

```bash
curl "https://api.apipay.kz/api/v1/subscriptions/1/invoices?page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

`per_page` accepts up to 100 records per page; a larger value is clamped to 100.

### Response Item Structure

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Subscription invoice record ID |
| `invoice_id` | integer\|null | Related invoice ID; `null` for a skipped period with no invoice issued |
| `billing_period_start` | string | Period start (YYYY-MM-DD) |
| `billing_period_end` | string | Period end (YYYY-MM-DD) |
| `billing_period_label` | string | Human-readable period label |
| `amount` | string\|null | Amount; `null` for a skipped period with no invoice issued |
| `attempt_number` | integer | Attempt number |
| `status` | string | Status: `pending`, `paid`, `failed`, `cancelled` or `skipped` — the period was closed without payment by the merchant's decision, it is not a debt (see [Skip a Period](#skip-a-period)) |
| `status_label` | string | Human-readable status |
| `status_color` | string | Color for UI rendering |
| `paid_at` | string\|null | Payment date (ISO 8601) |
| `failure_reason` | string\|null | Failure reason |
| `invoice` | object | `{ id, kaspi_invoice_id, status }`. Absent for a skipped period with no invoice issued |
| `created_at` | string | Created date (ISO 8601) |

## Statuses

| Status | Description |
|--------|-------------|
| `active` | Billing on schedule |
| `paused` | Temporarily paused, can be resumed |
| `cancelled` | Permanently cancelled |
| `expired` | Expired: the grace period ended (only without `bill_until_paid: true`) or `total_cycles` was exhausted. A subscription that expired after the grace period can be resumed (`resume`) |

## Grace Period

What happens on non-payment depends on the `bill_until_paid` field. Without it (or with `false`) the ladder below applies: retries, a grace period, `expired`. The `true` mode is described in [Keep invoicing until paid](#keep-invoicing-until-paid).

When a payment fails, the system enters a grace period:

1. **Payment fails** — System automatically retries
2. **Retries** — Up to `max_retry_attempts` times at `retry_interval_hours` intervals. The interval
   is respected for refusals on the merits — for example, when the number has no Kaspi
3. **An expired invoice is the exception** — it is reissued immediately and does not wait for the
   interval: the payer has already used up the invoice lifetime
4. **An explicit refusal ends everything** — if the buyer declined the invoice in Kaspi, the
   subscription is cancelled at once. Insufficient funds on the payer's side do not count as a refusal and
   lead to an ordinary retry
5. **Grace period active** — Subscription remains `active` during retries
6. **Expired** — if the payment still does not go through, the subscription moves to `expired` when the grace period ends: `grace_period_days` after the last failed attempt

Defaults, if you do not pass them at creation: `max_retry_attempts` — 3, `retry_interval_hours` — 24, `grace_period_days` — 3.

### Keep invoicing until paid

With `bill_until_paid: true` the subscription does not expire for non-payment:

1. **An expired invoice** is re-issued immediately until the next scheduled billing moment. After that a new period starts with a new invoice
2. **An invoice cancelled by someone other than the payer** (for example, insufficient funds) and **an invoice in `error` status** close the current period without a retry. A service-side error does not close the period — invoicing is retried automatically. `subscription.payment_failed` arrives as usual. The system does not request payment for a closed period again.
3. **The number is not registered in Kaspi** (`client_not_found`) — the subscription is cancelled: `subscription.cancelled` arrives with `reason: payer_error`, `invoice_id` and `error_code`, and no `subscription.payment_failed` is sent for that invoice
4. **An explicit refusal by the payer** cancels the subscription, just as without the mode

`retry_interval_hours` and `grace_period_days` have no effect in this mode, and `subscription.grace_period_started` is not sent.

> ⚠️ **`max_retry_attempts` is incompatible with this mode.** Together with `bill_until_paid: true` it
> returns `422` on the `max_retry_attempts` field. On `PUT` the rejection comes whenever the resulting
> mode is `true` (from the body or already saved), even if the number equals the current one;
> `max_retry_attempts: null` means “don't change”.
> If your integration sends the full subscription object from the response back in `PUT`, don't pass this field.

Switching the mode via `PUT` in either direction resets `failed_attempts`. Enabling the mode on a subscription in its grace period returns it to invoicing. The apipay.kz dashboard wizard creates a daily, weekly, biweekly, quarterly or yearly autopay with the mode on, so such subscriptions return `bill_until_paid: true`; the mode can be turned off later in the subscription's Settings tab. Non-monthly autopays uploaded to the dashboard from a spreadsheet are created without the mode (`bill_until_paid: false`). A monthly dashboard autopay does not have this mode and returns `bill_until_paid: false`.

> **Missed periods are not billed in a batch.** If a subscription could not charge for a long time —
> for example, the organization had no connected cashier — then on resumption a **single** invoice is
> issued for the current period and the schedule moves to the nearest future date.

Webhook events: `subscription.payment_failed`, `subscription.grace_period_started`, `subscription.payment_succeeded`, `subscription.expired`, `subscription.cancelled`. See [Webhooks](webhooks.md).

## Code Examples

### JavaScript

```javascript
const response = await fetch('https://api.apipay.kz/api/v1/subscriptions', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000,
    phone_number: '87001234567',
    billing_period: 'monthly',
    billing_day: 1
  })
})
const subscription = await response.json()
```

### Python

```python
import requests

response = requests.post(
    'https://api.apipay.kz/api/v1/subscriptions',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 5000, 'phone_number': '87001234567', 'billing_period': 'monthly'}
)
subscription = response.json()
```

### PHP

```php
$ch = curl_init('https://api.apipay.kz/api/v1/subscriptions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 5000, 'phone_number' => '87001234567', 'billing_period' => 'monthly'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$subscription = json_decode(curl_exec($ch), true);
```
