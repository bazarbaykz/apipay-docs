# Webhooks

Webhooks deliver real-time notifications when payment events occur.

## Configuration

Configure webhooks in [ApiPay.kz Dashboard](https://apipay.kz) → Settings → Connection:

1. Click **Add Webhook**
2. Enter your webhook URL
3. Save and copy the **secret** (shown only once!)

**URL requirements:** a public HTTPS address without your own authentication; private IPs and localhost are rejected (422). For not-yet-approved organizations in production the address must be on a **real domain**: IP → `422 webhook_url_requires_domain`, tunnels (ngrok and similar) → `422 webhook_url_tunnel_forbidden` (a tunnel is temporary and will go offline — notifications stop arriving). A tunnel is allowed in the sandbox for local testing. The restriction is lifted after the business profile is approved (see [Getting Started → Business verification](getting-started.md)).

> **All dates in webhooks are in UTC** (ISO 8601, `+00:00`).

## Events

ApiPay sends 20 event types:

| Event | Description |
|-------|-------------|
| `invoice.status_changed` | An invoice status changed |
| `invoice.qr_scanned` | The customer scanned the QR (status stays `pending`, `qr_substate=scanned`) |
| `invoice.refunded` | A refund on an invoice succeeded (or failed) |
| `qr_refund.identified` | The customer scanned the refund QR (session → `customer_identified`) |
| `qr_refund.completed` | The QR refund was completed (`refunded_amount`, `receipt_url`) |
| `qr_refund.expired` | The refund QR expired before the customer was identified |
| `catalog.item_processed` | An operation on a catalog item was closed. Sent **for every item, always** — there is no bulk aggregate any more |
| `receipt.issued` | A fiscal receipt was successfully issued (Kaspi OFD) |
| `receipt.failed` | Issuing a fiscal receipt failed |
| `subscription.created` | A subscription was created |
| `subscription.payment_succeeded` | A subscription invoice was paid |
| `subscription.payment_failed` | A subscription invoice was not paid |
| `subscription.grace_period_started` | The subscription entered the grace period |
| `subscription.expired` | The subscription expired |
| `subscription.paused` | The subscription was paused |
| `subscription.resumed` | The subscription was resumed |
| `subscription.cancelled` | The subscription was cancelled |
| `cashbox.shift_closed` | A cash register shift was closed |
| `cashbox.shift_close_failed` | Closing a cash register shift failed (`error_code`) |
| `webhook.test` | Test event from the dashboard |

> Full payloads for the `qr_refund.*` events are in `openapi.yaml`, section `x-webhooks`.

> ⛔ The `catalog.batch_processed` event is **never sent**: the aggregate for bulk catalog operations has been removed. Same address, same signature — just silence, and no error tells you so. If you were waiting on that webhook as the "upload finished" signal, switch to `catalog.item_processed` plus your own list of `external_ref` values.

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

#### QR invoice cancelled by the client (status: cancelled)

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
    "client_phone": null,
    "is_sandbox": false,
    "cancelled_at": "2026-02-12T14:45:00+00:00"
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
| `invoice.error_message` | string \| null | Human-readable reason. Always present at `status=error`; at `status=cancelled` only when filled (usually absent for a client cancellation or an API cancellation). Absent in `paid`/`pending`/`expired`. |
| `invoice.error_code` | string \| null | Stable snake_case code from the catalog (see [Error Codes](errors.md)). Present only when not `null` and only at `status=error`/`cancelled`. Build your logic on it, not on the text. |
| `invoice.subtotal` / `discount_sum` / `discount_percentage` | string \| null | Only for invoices with a cart/discount (`subtotal` and `discount_sum` come together). |
| `invoice.kaspi_source_type` | string \| null | Customer funding source: `GOLD`, `RED`, `LOAN`, `BUSINESSACCOUNT`, `BANKINTEGRATIONACCOUNT`. Gated by Kaspi returning a value; the list may grow. |
| `invoice.kaspi_sale_type` | string \| null | How the invoice was accepted: `Remote`, `QR`, `Restaurant`, `Static`. Gated by Kaspi returning a value; the list may grow. |

### invoice.qr_scanned

QR invoices only. Sent when the customer has scanned the QR and reached the payment screen in the Kaspi app. This is a **sub-state**: the invoice status stays `pending`, while the marker `qr_substate: "scanned"` shows the customer is already on the payment step. Sent exactly **once** per QR and transiently — a terminal webhook (`paid` or `cancelled`) follows. The signature is verified the same way as for the other events.

```json
{
  "event": "invoice.qr_scanned",
  "invoice": {
    "id": 63474,
    "external_order_id": "order-123",
    "amount": "5000.00",
    "status": "pending",
    "qr_substate": "scanned",
    "description": "Order #123",
    "kaspi_invoice_id": "13234689514",
    "client_name": null,
    "client_phone": null,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-06-14T10:00:00+00:00"
}
```

**Payload fields**

| Field | Type | Description |
|-------|------|-------------|
| `invoice.status` | string | Always `pending` — this is a sub-state, not a status change. The terminal status arrives as a separate `invoice.status_changed`. |
| `invoice.qr_substate` | string | `scanned` — the customer scanned the QR and is on the payment screen. |
| `invoice.kaspi_invoice_id` | string \| null | Invoice ID in Kaspi. |
| `invoice.client_name` / `client_phone` | null | At the scan stage the customer details are not yet known. |

> Use the event as a "customer started paying" signal (e.g. update the till UI). Do not treat the invoice as paid — wait for `paid`. The event is transient and may not arrive if the customer pays instantly.

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
    "available_for_refund": 5000,
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
| `refund.error_code` | string \| null | Only at `status=failed`. For example `refund_window_expired` — Kaspi rejected the refund. There is no `error_message` in the webhook by design — read the text in `GET /invoices/{id}/refunds` or resolve the code via the catalog. |
| `refund.items` | array \| null | Refund line items (only for itemized refunds): `catalog_item_id`, `name`, `price`, `count`, `amount`. |
| `invoice.available_for_refund` | number | Amount still available for refund. Comes as a number (float), unlike `amount` and `total_refunded` (strings). |
| `invoice.status` | string | Invoice status after the refund. A full refund does **not** change the status (stays `paid` — or `partially_refunded` if there was an earlier partial one) + `is_fully_refunded=true`; the first partial refund moves it to `partially_refunded` (and an `invoice.status_changed` is also sent). |

### catalog.item_processed

Sent when an operation on a catalog item is closed — a creation, an edit or a removal, successful or failed.

> ⚠️ **The event arrives for every item, always.** There is no bulk aggregate any more: uploading 50 items produces **up to 50 deliveries** instead of one. Your receiver has to handle that.

```json
{
  "event": "catalog.item_processed",
  "catalog_item": {
    "id": 12345,
    "external_ref": "1C-000123",
    "kaspi_item_id": "MP-000000",
    "name": "Coffee Beans 1 kg",
    "barcode": "4870000000001",
    "ntin": "00000000000001",
    "gtin": null,
    "ntin_missing": false,
    "status": "active",
    "sellable": true,
    "in_kaspi_catalog": true,
    "operation": null,
    "error_code": null,
    "error_message": null,
    "failed_at": null
  },
  "timestamp": "2026-08-26T14:37:00+00:00"
}
```

**Payload fields**

| Field | Type | Description |
|-------|------|-------------|
| `catalog_item.external_ref` | string \| null | Your own reference for the item (for example a 1C item code) — the reconciliation key. |
| `catalog_item.status` | string | The same derived status and the same vocabulary as `GET /catalog`: `active`, `pending`, `deleting`, `deleted`, `failed`. The push and the listing always agree. |
| `catalog_item.operation` | string \| null | What was happening to the item: `create`, `update`, `delete`. `null` after a successful completion; on a failure the value is kept. |
| `catalog_item.sellable` | boolean | Whether the item is accepted into an invoice cart, a QR or a subscription. |
| `catalog_item.in_kaspi_catalog` | boolean | Whether the item has a production Kaspi nomenclature identity. Always `false` in the sandbox. |
| `catalog_item.error_code` | string \| null | The failure code of the operation. |
| `catalog_item.failed_at` | string \| null | The moment of failure (ISO 8601). |
| `catalog_item.ntin_missing` | boolean | `true` — the item has a barcode but no NTIN: it will not enter a fiscal receipt as a marked good. |

More on statuses, the `operation` axis and the flags: [Catalog](catalog.md#item-statuses).

"The bulk work is done" is a conclusion you draw from your own list of `external_ref` values. The remaining queue and the failures are also visible through `GET /catalog/queue` and `GET /catalog/errors`.

### receipt.issued

Sent when a fiscal receipt is successfully issued in Kaspi OFD (after `POST /receipts`). Equivalent to polling `GET /receipts/{id}`. If receipt webhooks do not arrive for you, use polling — the result is the same. See [Fiscal Receipts](receipts.md) for details.

```json
{
  "event": "receipt.issued",
  "receipt": {
    "id": 4210,
    "client_operation_id": "pos-2026-07-12-0042",
    "payment_type": 3,
    "status": "issued",
    "fpd": "000000000000",
    "operation_id": "KKM00000000",
    "link": "https://receipt.kaspi.kz/preview/cashier?extTranId=KKM00000000",
    "shift_number": 106,
    "total_price": "10.00",
    "error_code": null,
    "error_message": null
  },
  "timestamp": "2026-07-12T16:25:43+00:00"
}
```

### receipt.failed

Sent when issuing a fiscal receipt fails. The reason is in `receipt.error_code`: `shift_closed` — the shift is closed; `item_not_fiscal` — a line item has no NTIN; `rfo_missing`; `kaspi_session_invalid` — the cashier session is not valid, reconnect the cashier; `kaspi_session_not_configured`; `fiscal_receipts_disabled`; `receipt_ofd_token_revoked` — the till's fiscal link to the OFD has been revoked and the merchant must re-link it in the Kaspi app; `receipt_kaspi_error`; `receipt_dispatch_error`. The fiscal document was **not** created — retry with the **same** `client_operation_id`: after `failed` the previous key is released. For `shift_closed`, first open the shift in Kaspi Pos.

```json
{
  "event": "receipt.failed",
  "receipt": {
    "id": 4210,
    "client_operation_id": "pos-2026-07-12-0042",
    "payment_type": 3,
    "status": "failed",
    "fpd": null,
    "operation_id": null,
    "link": null,
    "shift_number": null,
    "total_price": "10.00",
    "error_code": "shift_closed",
    "error_message": "Shift is not open"
  },
  "timestamp": "2026-07-12T16:25:43+00:00"
}
```

**Payload fields**

| Field | Type | Description |
|-------|------|-------------|
| `receipt.status` | string | `issued` (success) or `failed` (failure). |
| `receipt.fpd` | string \| null | Fiscal document sign. Filled at `issued`, `null` at `failed`. |
| `receipt.operation_id` | string \| null | Operation ID in Kaspi. Filled at `issued`. |
| `receipt.link` | string \| null | Link to the receipt on `receipt.kaspi.kz`. Filled at `issued`. |
| `receipt.shift_number` | integer \| null | Shift number. Filled at `issued`. |
| `receipt.error_code` | string \| null | Only at `status=failed` — a stable code from the catalog (see [Error Codes](errors.md)). Build your logic on it. |

> Deduplicate by `(event, receipt.id)`. All dates are in UTC (`+00:00`).

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
    "next_billing_at": "2026-03-01T08:00:00+00:00",
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
    "next_billing_at": "2026-03-01T08:00:00+00:00",
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
    "next_billing_at": "2026-03-01T08:00:00+00:00",
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
    "next_billing_at": "2026-03-01T08:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "source": "My API Key",
  "timestamp": "2026-02-20T18:00:00+00:00"
}
```

The subscription is cancelled irreversibly: `next_billing_at` keeps its last value, and no invoices are issued anymore. To resume, create a new subscription.

A cancellation also arrives without a request from you: if the payer declined the invoice in Kaspi, the subscription is cancelled at once and the payload root carries `reason: payer_refused` and `invoice_id`. Insufficient funds on the payer's side do not count as a refusal — those lead to ordinary retries.

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
| `invoice.qr_scanned` | `pending` | QR only: the customer scanned the QR (`qr_substate=scanned`). The status stays `pending`, a sub-state. Once, transiently — then `paid` or `cancelled`. |
| `invoice.status_changed` | `paid` | The invoice was paid. May arrive even **after** `cancelled`/`expired` — a last-second payment wins the race (see "Status transitions"). |
| `invoice.status_changed` | `cancelled` | The invoice was cancelled: by the client (minimized/closed the app), by you via the API, or by the cashier. A new QR on the same till does **not** cancel the old one. |
| `invoice.status_changed` | `expired` | The invoice expired: phone invoices — 24 hours in Kaspi; QR — minutes, only once Kaspi returns the terminal (not on a local timer). |
| `invoice.status_changed` | `error` | A technical error — the invoice is finalized, the system no longer retries it. The reason is in `error_code`/`error_message` (see "Response scenarios"). |
| `invoice.status_changed` | `partially_refunded` | The first partial refund on the invoice (in addition to `invoice.refunded`). Subsequent partial refunds don't change the status. |
| `invoice.refunded` | `completed` | The refund went through. Includes refunds made by the cashier in the Kaspi app (imported automatically). |
| `invoice.refunded` | `failed` | The refund failed (`refund.error_code`). The system does **not** retry; the amount is not locked — you can create a new refund. |
| `receipt.issued` | — | A fiscal receipt was issued in Kaspi OFD (after `POST /receipts`). Details in `fpd`/`operation_id`/`link`. Equivalent to polling `GET /receipts/{id}`. |
| `receipt.failed` | — | The receipt was not issued (`receipt.error_code`). No fiscal document was created — retry with the same `client_operation_id` (for `shift_closed`, first open the shift in Kaspi Pos; for `receipt_ofd_token_revoked`, re-link the OFD). |
| `subscription.created` | — | The subscription was created. The system issues subscription invoices automatically at `next_billing_at` (or immediately with `bill_immediately`). Each invoice triggers the regular invoice webhooks. |
| `subscription.payment_succeeded` | — | The next subscription invoice was paid. `failed_attempts` is reset; the grace period (if any) is lifted. |
| `subscription.payment_failed` | — | The subscription invoice expired or was cancelled (`reason`). While attempts are below `max_retry_attempts` the system re-issues the invoice itself — nothing to recreate. |
| `subscription.grace_period_started` | — | All retries are exhausted; the subscription stays active for `grace_period_days`. Any successful payment lifts the grace period. |
| `subscription.expired` | — | Billing is stopped for good: either the grace period ended or the `total_cycles` charges were used up — in the latter case the payload root carries `reason: total_cycles_reached`, `cycles_paid` and `total_cycles`. To resume, create a new subscription. |
| `subscription.paused` | — | The subscription was paused. No invoices are issued. |
| `subscription.resumed` | — | The subscription was resumed; `next_billing_at` is recalculated from the moment of resumption. |
| `subscription.cancelled` | — | The subscription was cancelled irreversibly: by your request or by an explicit refusal from the payer in Kaspi — in the latter case the payload root carries `reason: payer_refused` and `invoice_id`. |
| `webhook.test` | — | A manual test from the dashboard. A dummy invoice with `status=test` — just ignore it. |

## Status transitions

ApiPay does not duplicate webhooks for the same status: consecutive duplicates of one status, the technical `processing`/`cancelling`, a stale `pending` after a terminal status, and `error` after `paid` are not sent. Delivery itself is at-least-once and not guaranteed: the same transition can be re-delivered (retries after a partial delivery), and during a circuit-breaker pause it is not delivered at all. Deduplicate by `(invoice.id, status)` and `(refund.id, status)`, and reconcile state via the GET methods. Respond `200 OK` quickly (≤5 seconds) and process asynchronously.

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
| `kaspi_throttled` | Kaspi rate-limited the till's requests | Spreads that till's invoices out over time and retries; the webhook = finalization | While the invoice is in `processing` — nothing. After `error` — a new invoice in 2–3 minutes; reduce your invoice creation rate |
| `organization_not_configured` | No Kaspi cashier is connected to the organization | Finalizes immediately | Connect a cashier: dashboard → Settings → Kaspi Authorization |
| `invoice_already_paid` | An attempt to cancel an already-paid invoice | Stopped the cancellation; the money is received | Don't cancel; to return the money, create a refund |
| `invoice_already_cancelled` | The invoice is already cancelled | — | Nothing: the desired state is already reached |
| `invoice_not_found_in_kaspi` | Kaspi could not find the invoice during cancellation | Finalizes `error` | Contact support |
| `refund_window_expired` | Kaspi rejected the refund: the refund window may have expired, or the refund was already made | Refund `failed`, no retries | Don't repeat; notify the customer or contact support |
| `qr_render_failed` | The QR image could not be rendered | The invoice is finalized in `error` (both a 500 response and a webhook) | Retry `POST /invoices/qr` — a new invoice is created |
| `kaspi_session_invalid` | The cashier session expired while creating the QR | The invoice is finalized in `error`; the session is invalidated | Retry later; if it recurs — reconnect the cashier |
| `kaspi_error` | An unclassified Kaspi error | Depends on the cause; for QR — invoice `error` + webhook | Read `message`/`error_message`; retry or contact support |
| `unknown_error` | An unexpected error (including all creation attempts exhausted) | Finalized after all retries | Create a new invoice; if it recurs — support |

**Scenarios without an `error_code`:**

- **A new QR on the same till** — QR invoices coexist: creating a new QR does **not** cancel the previous ones, and the supersede webhook (`cancelled` with "Superseded by new QR invoice #N") no longer exists. Two parallel `POST /invoices/qr` both get `201` + `pending`. React per `invoice.id` separately — if several QRs are paid, you'll get several `paid` webhooks. (`409 superseded` is a defensive branch, unreachable in practice — don't build logic on it.)
- **The client cancelled the QR** — a `cancelled` webhook = a real client cancellation (they minimized or closed the Kaspi app), not a system supersede. Create a new invoice if needed.
- **The client scanned the QR** — an `invoice.qr_scanned` webhook (`qr_substate=scanned`, status stays `pending`): the customer is on the payment screen. A "payment started" signal — do not treat the invoice as paid, wait for `paid`.
- **Invoice expired** — an `expired` webhook (phone invoices — 24h; QR — minutes, on the terminal from Kaspi). Create a new invoice if needed.
- **Payment after cancellation/expiry** — a `paid` webhook after `cancelled`/`expired`: the money is received — ship the order or issue a refund.
- **Back to `pending` after `error`** — a corrective `pending` webhook (reconciliation). Follow the latest status.

## Signature Verification

Every request includes `X-Webhook-Signature: sha256=<HMAC-SHA256>` — an HMAC-SHA256 over the raw request body. The header is absent if the key has no webhook secret configured.

### JavaScript

```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(signature || '')
  if (receivedBuf.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, receivedBuf)
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

> `subscription.*` events are not written to the dashboard Webhook logs: there is no manual retry or circuit breaker for them — reconcile subscription state via `GET /subscriptions/{id}`.

## Response Requirements

1. Return a **2xx status** within **5 seconds** (delivery timeout: 5s for the response plus up to 3s to establish the connection)
2. Be **idempotent** — handle duplicate deliveries

### Deduplication

Client-side deduplication is **mandatory**: a retry after a partial delivery to multiple receivers re-sends the webhook to all of them. Deduplication keys:

- `(invoice.id, invoice.status)` — for invoice events
- `(refund.id, refund.status)` — for refunds
- `(event, receipt.id)` — for receipt events (`receipt.issued`/`receipt.failed`)
- `(event, subscription.id, invoice_id)` — for subscription events

## Security Best Practices

1. **Always verify signatures**
2. **Use HTTPS** in production
3. **Store secrets in environment variables**
4. **Use idempotency keys** (see "Deduplication")
