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

ApiPay sends 23 event types:

| Event | Description |
|-------|-------------|
| `invoice.status_changed` | An invoice status changed |
| `invoice.qr_scanned` | The customer scanned the QR (status stays `pending`, `qr_substate=scanned`) |
| `invoice.refunded` | A refund on an invoice succeeded (or failed) |
| `qr_refund.identified` | The customer scanned the refund QR (session → `customer_identified`) |
| `qr_refund.completed` | The refund via the buyer link was completed (`refunded_amount`, `receipt_url`) |
| `qr_refund.expired` | The link ran out without a refund: it expired, was revoked, or the last scan window was missed. For a link bound to an invoice it can also arrive after `qr_refund.identified` if the refund did not go through in time. No money moved — a new link is needed |
| `qr_refund.failed` | The refund via the link did not happen, no money moved. The reason is in `error_code`; for a link bound to an invoice it can also arrive after `qr_refund.identified` (for example, `refund_insufficient_funds`) |
| `qr_refund.execution_uncertain` | The outcome of the refund via the link is not proven: the money may have gone out. Do not repeat the refund — not by request, not with a new link, not by hand in the Kaspi Pay app — it is resolved manually via support |
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
| `subscription.period_skipped` | A subscription period was skipped without payment |
| `subscription.cancelled` | The subscription was cancelled |
| `cashbox.shift_closed` | A cash register shift was closed |
| `cashbox.shift_close_failed` | Closing a cash register shift failed (`error_code`) |
| `webhook.test` | Test event from the dashboard |

> Full payloads for the `qr_refund.*` events are in `openapi.yaml`, section `x-webhooks`. How to issue a link to the buyer and what to do with each event — [Refunds → Fallback](refunds.md#fallback-a-link-to-the-buyer).

> ⛔ The `catalog.batch_processed` event is **never sent**: the aggregate for bulk catalog operations has been removed. Same address, same signature — just silence, and no error tells you so. If you were waiting on that webhook as the "upload finished" signal, switch to `catalog.item_processed` plus your own list of `external_ref` values.

### invoice.status_changed

Sent when an invoice status changes.

```json
{
  "event": "invoice.status_changed",
  "is_sandbox": false,
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

> **Note:** Fields `subtotal`, `discount_sum`, and `discount_percentage` appear only when the invoice has discounts applied. Every event carries an `is_sandbox` field at the root of the signed body: it shows whether the event's object was created in the sandbox; the nested `is_sandbox` (here, in `invoice`) matches it. The root `is_sandbox` describes the event's object, not the organization's current mode: your system knows its own mode. How to handle sandbox events in production mode is covered in "Response Requirements". Fields `kaspi_source_type` and `kaspi_sale_type` are gated by Kaspi returning a value (treat them as nullable). Next to `client_phone` comes `phone` — the same number under its REST name. For a payment attempt made via a payment link or a printed sheet, `invoice` carries `static_qr_id` and its synonym `static_qr_code_id` — use them to find the order (see [Invoices → Payment link and printed QR](invoices.md#payment-link-and-printed-qr)). There are no QR fields (`is_qr_token`, `qr_token_url`, `qr_image_url`) in this event — they are in `GET /invoices/{id}`.

#### Invoice not processed (status: error)

```json
{
  "event": "invoice.status_changed",
  "is_sandbox": false,
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
  "is_sandbox": false,
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
  "is_sandbox": false,
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
| `invoice.static_qr_id` / `static_qr_code_id` | integer | The payment link or printed sheet this invoice is an attempt of. Only on such invoices. |
| `invoice.phone` | string \| null | Synonym of `client_phone` (the REST name). |

### invoice.qr_scanned

QR invoices only. Sent when the customer has scanned the QR and reached the payment screen in the Kaspi app. This is a **sub-state**: the invoice status stays `pending`, while the marker `qr_substate: "scanned"` shows the customer is already on the payment step. Sent exactly **once** per QR and transiently — a terminal webhook (`paid` or `cancelled`) follows. The signature is verified the same way as for the other events.

```json
{
  "event": "invoice.qr_scanned",
  "is_sandbox": false,
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
  "is_sandbox": false,
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
  "is_sandbox": false,
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
| `refund.error_code` | string \| null | Only at `status=failed`. `refund_requires_buyer_confirmation` and `refund_rejected_by_kaspi` signal the fallback: issue a link to the buyer with this refund's `source_refund_id` (see [Refunds](refunds.md#fallback-a-link-to-the-buyer)). There is no `error_message` in the webhook by design — read the text in `GET /invoices/{id}/refunds` or resolve the code via the catalog. |
| `refund.items` | array \| null | Refund line items (only for itemized refunds): `catalog_item_id`, `name`, `price`, `count`, `amount`. |
| `invoice.available_for_refund` | number | Amount still available for refund. Comes as a number (float), unlike `amount` and `total_refunded` (strings). |
| `invoice.status` | string | Invoice status after the refund. A full refund does **not** change the status (stays `paid` — or `partially_refunded` if there was an earlier partial one) + `is_fully_refunded=true`; the first partial refund moves it to `partially_refunded` (and an `invoice.status_changed` is also sent). |

> ⚠️ After `qr_refund.completed`, an `invoice.refunded` with `status: completed` and an **unfamiliar** `refund.id` may arrive — a record that the sync created for the operation carried out via the buyer link. It is the same amount, not a second refund: the original refund in `GET /invoices/{id}/refunds` will have `successor_refund_id` equal to this id. Resolving an unknown outcome as "money went out" (`refund_resolved_executed`) sends no webhook for the original refund.

### catalog.item_processed

Sent when an operation on a catalog item is closed — a creation, an edit or a removal, successful or failed.

> ⚠️ **The event arrives for every item, always.** There is no bulk aggregate any more: uploading 50 items produces **up to 50 deliveries** instead of one. Your receiver has to handle that.

```json
{
  "event": "catalog.item_processed",
  "is_sandbox": false,
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
  "is_sandbox": false,
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
  "is_sandbox": false,
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

> Deduplicate by `(event, receipt.id)`: after your server fails (5xx, 429, network), the receipt notification is retried automatically, so one `receipt.*` event can arrive twice. All dates are in UTC (`+00:00`).

### subscription.created

Sent when a subscription is created.

```json
{
  "event": "subscription.created",
  "is_sandbox": false,
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
  "is_sandbox": false,
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
  "is_sandbox": false,
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

> The system **re-issues** the invoice itself — you don't need to recreate anything, just notify the customer (`attempt_number`, `reason`). With `bill_until_paid: false` a retry happens while `attempt_number` is below `max_retry_attempts` (3 by default), at the `retry_interval_hours` interval (24h by default). With `bill_until_paid: true` an expired invoice is re-issued until the next scheduled billing moment, and after a cancelled or failed invoice (except a service-side error) the next one comes in the next period. A subscription invoice that ends in `error` also triggers this event, with the code in `error_code`. The exception: for a subscription with `bill_until_paid: true` and `error_code = client_not_found`, `subscription.cancelled` with `reason: payer_error` arrives instead.

### subscription.grace_period_started

Sent when a subscription enters the grace period after the retries are exhausted.

```json
{
  "event": "subscription.grace_period_started",
  "is_sandbox": false,
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

The subscription stays active for `grace_period_days` (3 by default). Any successful payment lifts the grace period. This event is not sent for a subscription with `bill_until_paid: true`.

### subscription.expired

Sent when a subscription expires after all retries fail.

```json
{
  "event": "subscription.expired",
  "is_sandbox": false,
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

Billing for the subscription is stopped. A subscription that expired after the grace period can be resumed with `POST /subscriptions/{id}/resume`. A subscription that has received all `total_cycles` payments cannot be resumed — create a new one.

### subscription.paused

Sent when a subscription is paused (`POST /subscriptions/{id}/pause`).

```json
{
  "event": "subscription.paused",
  "is_sandbox": false,
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
  "is_sandbox": false,
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

### subscription.period_skipped

Sent when the merchant skips a subscription period without payment — via `POST /subscriptions/{id}/skip-period` or in the ApiPay dashboard. The event does not carry the reason for the skip.

```json
{
  "event": "subscription.period_skipped",
  "is_sandbox": false,
  "subscription": {
    "id": 10,
    "external_subscriber_id": "CLIENT-001",
    "phone_number": "87071234567",
    "subscriber_name": "Ivan Ivanov",
    "amount": "5000.00",
    "billing_period": "monthly",
    "status": "active",
    "next_billing_at": "2026-04-01T08:00:00+00:00",
    "failed_attempts": 0,
    "in_grace_period": false,
    "is_sandbox": false
  },
  "billing_period_start": "2026-03-01",
  "billing_period_end": "2026-03-31",
  "cancelled_invoice_id": 202,
  "source": "My API Key",
  "timestamp": "2026-03-02T09:00:00+00:00"
}
```

Extra fields in the payload root: `billing_period_start` and `billing_period_end` — boundaries of the skipped period, and `cancelled_invoice_id` — the period's invoice whose cancellation the skip requested (`null` if no invoice had been issued yet). The subscription stays active and the next period is invoiced on schedule; in the payment history the period has status `skipped`.

The outcome of the invoice cancellation arrives in a separate `invoice.status_changed`. If Kaspi does not accept the cancellation, the invoice returns to `pending` without a webhook and stays available to the buyer. If the buyer pays that invoice, the period counts as paid: `subscription.payment_succeeded` arrives with `invoice_id` equal to `cancelled_invoice_id`. The events may arrive in any order — the period ends up `paid`. If the buyer has already settled with you another way, refund the extra payment yourself via `POST /invoices/{id}/refund`.

Deduplicate on `(event, subscription.id, billing_period_start)`: a skipped period may have no invoice.

### subscription.cancelled

Sent when a subscription is cancelled.

```json
{
  "event": "subscription.cancelled",
  "is_sandbox": false,
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

A cancellation also arrives without a request from you: if the payer declined the invoice in Kaspi, the subscription is cancelled at once and the payload root carries `reason: payer_refused` and `invoice_id`. Insufficient funds on the payer's side do not count as a refusal: without `bill_until_paid: true` ordinary retries follow, with it the period closes without a retry.

For a subscription with `bill_until_paid: true` a cancellation also arrives when an invoice failed with `error_code = client_not_found` (the number is not registered in Kaspi): the payload root carries `reason: payer_error`, `invoice_id` and `error_code`.

### webhook.test

Sent by the «Проверить уведомления» (check notifications) button on the key card in the dashboard or by a `POST /webhook-test` request with your key — synchronously, in a single attempt, with the outcome in the response. A dummy invoice with `status=test` — your receiver should simply ignore it.

```json
{
  "event": "webhook.test",
  "is_sandbox": true,
  "invoice": {
    "id": null,
    "external_order_id": "TEST-ORDER-123",
    "amount": "1000.00",
    "status": "test",
    "description": "Test webhook notification",
    "kaspi_invoice_id": null,
    "client_name": "Test Client",
    "client_phone": "87771234567",
    "is_sandbox": true,
    "kaspi_source_type": "GOLD",
    "kaspi_sale_type": "Remote"
  },
  "source": "My API Key",
  "timestamp": "2026-01-15T10:00:00+00:00"
}
```

For `webhook.test` the root `is_sandbox` is always `true`: in production mode the handler discards it with a `2xx`, and the test passes. Verify the signature before discarding sandbox events — then a passing test also confirms the secret is correct.

`POST /webhook-test` accepts `signature`: `valid` (default), `invalid` (signed with a foreign secret) or `missing` (no `X-Webhook-Signature`). The last two check that your handler **rejects** a forged or unsigned body, and work only in the sandbox (a production organization gets `403 not_sandbox`). A successful check also re-enables disabled sending (see "Sending pause").

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
| `invoice.refunded` | `failed` | The refund failed (`refund.error_code`). The system does **not** retry. On `refund_requires_buyer_confirmation` and `refund_rejected_by_kaspi`, issue a link to the buyer with `source_refund_id`; with `hold_for_buyer_confirmation: true` the invoice is held for this refund. |
| `receipt.issued` | — | A fiscal receipt was issued in Kaspi OFD (after `POST /receipts`). Details in `fpd`/`operation_id`/`link`. Equivalent to polling `GET /receipts/{id}`. May arrive again. |
| `receipt.failed` | — | The receipt was not issued (`receipt.error_code`). No fiscal document was created — retry with the same `client_operation_id` (for `shift_closed`, first open the shift in Kaspi Pos; for `receipt_ofd_token_revoked`, re-link the OFD). |
| `subscription.created` | — | The subscription was created. The system issues subscription invoices automatically at `next_billing_at` (or immediately with `bill_immediately`). Each invoice triggers the regular invoice webhooks. |
| `subscription.payment_succeeded` | — | The next subscription invoice was paid. `failed_attempts` is reset; the grace period (if any) is lifted. |
| `subscription.payment_failed` | — | The subscription invoice expired, was cancelled or ended in `error` (`reason`, `error_code`). The system re-issues the invoice itself under the rules of the `bill_until_paid` mode — nothing to recreate. |
| `subscription.grace_period_started` | — | All retries are exhausted; the subscription stays active for `grace_period_days`. Any successful payment lifts the grace period. Not sent with `bill_until_paid: true`. |
| `subscription.expired` | — | Billing is stopped: either the grace period ended or the `total_cycles` charges were used up — in the latter case the payload root carries `reason: total_cycles_reached`, `cycles_paid` and `total_cycles`. A subscription that expired after the grace period can be resumed (`POST /subscriptions/{id}/resume`); after `total_cycles`, only a new subscription. |
| `subscription.paused` | — | The subscription was paused. No invoices are issued. |
| `subscription.resumed` | — | The subscription was resumed; `next_billing_at` is recalculated from the moment of resumption. |
| `subscription.period_skipped` | — | The merchant skipped a period without payment. The subscription stays active; the payload root carries `billing_period_start`, `billing_period_end`, `cancelled_invoice_id`. If the period's invoice had been issued, ApiPay requested its cancellation: the outcome arrives in `invoice.status_changed`, and if Kaspi does not accept the cancellation, no webhook is sent and the invoice stays `pending`. |
| `subscription.cancelled` | — | The subscription was cancelled irreversibly: by your request or by an explicit refusal from the payer in Kaspi — in the latter case the payload root carries `reason: payer_refused` and `invoice_id`. For a subscription with `bill_until_paid: true` also on `client_not_found`: `reason: payer_error`, `invoice_id`, `error_code`. |
| `webhook.test` | — | A manual test from the dashboard. A dummy invoice with `status=test` — just ignore it. |

## Status transitions

ApiPay does not generate repeated events for the same status: consecutive duplicates of one status, the technical `processing`/`cancelling`, a stale `pending` after a terminal status, and `error` after `paid` are not sent. But delivery is not guaranteed, and the same event may arrive more than once; during a sending pause, invoice and refund events are not sent and not re-sent later (see [Sending pause](#sending-pause)). Deduplicate by `(invoice.id, invoice.status)` and `(refund.id, refund.status)`, and reconcile state via the GET methods. Respond `200 OK` quickly (≤5 seconds) and process asynchronously.

> ⚠️ After `error`, `pending` may arrive again even if `pending` was already delivered for this invoice: it is a new transition, not a duplicate. Do not drop it — when `error` arrives, remove this invoice's `pending` key from your processed-events table, and when `pending` arrives — its `error` key: the chain `error → pending → … → error` is possible. In the sandbox this transition also sends a webhook, as in production.

**Allowed transitions:**

| From | To | Comment |
|------|----|---------|
| `pending` | `paid` / `cancelled` / `expired` / `error` | the normal lifecycle |
| `cancelled` / `expired` | `paid` | a last-second payment wins the race — handle it as "money received": ship the order or issue a refund. This is not a bug. |
| `error` | `pending` | reconciliation: the invoice actually did get created in Kaspi — follow the latest status. If you have already issued a new invoice for the order, cancel one of the two, otherwise the buyer can pay both |
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
- **Back to `pending` after `error`** — a corrective `pending` webhook (reconciliation). It is a new transition, not a duplicate — even if `pending` was already delivered for the invoice. Follow the latest status and do not close the order for good on `error`.

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

A failed delivery is retried automatically. The number of attempts depends on the event and the mode:

| Event | Attempts in production mode | Attempts in the sandbox |
|---|---|---|
| `invoice.status_changed` | up to 11 | up to 3 (up to 11 with `webhook_retry_grid: live` in the [sandbox state](sandbox.md)) |
| `invoice.refunded`, `subscription.*` | up to 11 | up to 11 |
| `invoice.qr_scanned`, `qr_refund.*`, `cashbox.*` | up to 11 | up to 3 |
| `receipt.*`, `catalog.item_processed` | up to 3 | up to 3 |
| `webhook.test` | one synchronous attempt | one synchronous attempt |

- **Intervals in production mode** (attempts include the first one, delays are approximate):
  - `invoice.status_changed`, `invoice.refunded`, `subscription.*` — retries after 10s, 30s, 1m, 1.5m, 2m, 5m, 10m, 15m, 30m, 1h: about 2 hours from the first attempt to the last;
  - `qr_refund.*`, `cashbox.*` — after 10s, 30s, 1m, 1.5m, 2m, 5m, then every 10m: about 50 minutes;
  - `invoice.qr_scanned` — after 10s, 30s, 1m, then every 2m: about 16 minutes, a scan matters only while the QR is alive;
  - `receipt.*`, `catalog.item_processed` — after 10s and 1m.
- **Intervals in the sandbox.** `invoice.refunded`, `subscription.*`, `receipt.*` and `catalog.item_processed` retry as in production mode. `invoice.status_changed`, `invoice.qr_scanned`, `qr_refund.*` and `cashbox.*` retry after 5s and 15s; `invoice.status_changed` with `webhook_retry_grid: live` gets 11 attempts with the production delays compressed to about 10 minutes.
- **Success:** a delivery counts as successful only on an HTTP **2xx** response
- **What is retried:** HTTP ≥500, exactly 429, and network errors. 4xx responses (except 429) are not retried: the attempt is recorded as failed (`status: failed`), and this transition will not be sent again on its own.
- **Redirects:** 307 and 308 are followed — the same `POST` with the same body and signature. 301, 302 and 303 are not followed (a client must change the method on them and drop the body): the delivery fails without a retry, and the log shows `redirect not followed`. Configure the final `https://` address right away.
- **Manual retry:** a failed delivery can be re-sent in the dashboard — «Лог уведомлений» (notification log), the retry button on the entry. In the sandbox, `POST /webhook-logs/{id}/retry` does the same — with the same body to the key's current address.
- **All dates in webhooks are in UTC** (ISO 8601, `+00:00`)

### Delivery log

`GET /webhook-logs` — rows for all of the organization's events except `catalog.item_processed` (the catalog has its own log, `GET /catalog/webhook-logs`): invoices, refunds, `qr_refund.*`, `subscription.*`, `receipt.*`, `cashbox.*`, `webhook.test`. Filters — `invoice_id`, `event`, `status` (`success`, `failed`, `skipped`), dates. A `qr_refund.*` row has `invoice_id` filled in — the invoice the link was issued for; `subscription.payment_succeeded` and `subscription.payment_failed` rows carry the charge invoice. The log is kept for 14 days; details of one delivery — `GET /webhook-logs/{id}`.

### Sending pause

After a series of consecutive failed deliveries, webhook sending for the key is paused automatically.

- **What observes the pause:** invoice events (`invoice.status_changed`, `invoice.qr_scanned`), refunds (`invoice.refunded`) and `qr_refund.*`. While the pause is on, they are **neither sent nor queued**: each one lands in the log as a `status: skipped` row ("skipped: pause", `error_message: circuit_open`), and such events are not retried later.
- **What goes out as usual:** `subscription.*`, `receipt.*`, `cashbox.*` and `catalog.item_processed` ignore the pause and go out with the usual retries.
- **State of your key** — `GET /webhook-logs/delivery-state`: `state` (`open`, `paused`, `disabled`), `paused_until`, `consecutive_failures`. `paused` lifts on its own after `paused_until`. If failures persist, sending is disabled (`disabled`) — it is re-enabled by changing the address or the secret (including issuing a new secret), or by a successful webhook check («Проверить уведомления» in the dashboard or `POST /webhook-test`). The same actions also lift a pause early.
- **The consecutive-failure counter** is reset by a successful delivery of an invoice, refund, `qr_refund.*` or `cashbox.*` event.

Recover transitions skipped during a pause by polling: `GET /invoices/{id}`, `GET /invoices/{id}/refunds`, `GET /qr-refunds/{id}`. Reconcile subscription and receipt events that were not delivered after all retries via `GET /subscriptions/{id}` and `GET /receipts/{id}`.

## Response Requirements

1. Return a **2xx status** within **5 seconds** (delivery timeout: 5s for the response plus up to 3s to establish the connection)
2. Be **idempotent** — the same event may arrive several times, including a receipt notification; a repeated delivery must not ship the order again, send the receipt to the buyer again or record the refund twice
3. In production mode, verify the signature first, then discard events with `is_sandbox: true` at the root of the body: reply `2xx` and do not act on them. An event about a sandbox object sent before the organization switched to production may arrive after the switch.

### Deduplication

Client-side deduplication is **mandatory**: a retry after a partial delivery to multiple receivers re-sends the webhook to all of them. Take the key before processing and release it if processing fails. Deduplication keys:

- `(invoice.id, invoice.status)` — for `invoice.status_changed`. The exception is `pending` after `error` and `error` after such a `pending`: these are new transitions, not duplicates. When `error` arrives, remove this invoice's `pending` key, and when `pending` arrives — its `error` key
- `(refund.id, refund.status)` — for refunds. An unfamiliar `refund.id` after `qr_refund.completed` is the same amount — reconcile by `successor_refund_id`
- `(event, qr_refund.id)` — for the buyer-link events `qr_refund.*`
- `(event, receipt.id)` — for receipt events (`receipt.issued`/`receipt.failed`)
- `(event, operation.id)` — for `cashbox.*`
- `(event, subscription.id, invoice_id)` — for subscription events. A root `invoice_id` is present only in `subscription.payment_succeeded`, `subscription.payment_failed` and `subscription.cancelled` with `reason` `payer_refused` or `payer_error`; `subscription.period_skipped` has none — the key is `(event, subscription.id, billing_period_start)`

If you deduplicate by `invoice.id` alone, you will lose the `paid → partially_refunded` transition. And do not close an order for good on `cancelled` or `expired`: `cancelled → paid` and `expired → paid` are legitimate.

## Security Best Practices

1. **Always verify signatures**
2. **Use HTTPS** in production
3. **Store secrets in environment variables**
4. **Use idempotency keys** (see "Deduplication")
