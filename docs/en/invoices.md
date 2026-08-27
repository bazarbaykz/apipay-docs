# Invoices

Invoices are the core of ApiPay.kz. Each invoice represents a payment request sent to a customer.

## Create Invoice

**Endpoint:** `POST /invoices`

Creates a new payment invoice. Supports two modes: flat amount or cart items.

### Request (flat amount)

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "phone_number": "87001234567",
    "description": "Payment for order #123",
    "external_order_id": "order_123"
  }'
```

### Request (with cart items)

For organizations with catalog enabled:

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "description": "Cart order",
    "cart_items": [
      {"catalog_item_id": 101, "count": 2, "price": 4500.00},
      {"catalog_item_id": 205, "count": 3}
    ],
    "discount_percentage": 10
  }'
```

Amount is calculated automatically from catalog item prices. Supports custom price overrides and discounts.

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes* | Amount in KZT, **whole tenge only**: 1 - 99,999,999. A fractional value → `422 amount_must_be_whole_tenge`; both `amount` and the `cart_items` total after discounts are checked. If you need tiyn, use `POST /invoices/qr`. *Not required with cart_items. |
| `phone_number` | string | Yes | Customer phone (format: 8XXXXXXXXXX) |
| `description` | string | No | Payment description (max 60 chars — Kaspi shows the buyer only the first 60) |
| `external_order_id` | string | No | Your order ID (max 255 chars) |
| `cart_items` | array | No | Array of cart items (replaces amount) |
| `discount_percentage` | number | No | Global discount percentage (1-99). Applied to the entire invoice. |

### Cart Item Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `catalog_item_id` | integer | Yes | Catalog item ID (from GET /catalog) |
| `count` | integer | Yes | Quantity (min 1) |
| `price` | number | No | Custom price override (0.01 - 99999999.99). Replaces catalog price. |

### Response

```json
{
  "id": 124,
  "amount": "9500.00",
  "status": "processing",
  "description": "Payment for order #123",
  "external_order_id": "order_123",
  "phone_number": "87001234567",
  "subtotal": "10000.00",
  "discount_sum": "500.00",
  "discount_percentage": "10",
  "error_message": null,
  "paid_at": null,
  "created_at": "2025-01-31T12:00:00Z"
}
```

> **Note:** Fields `subtotal`, `discount_sum`, and `discount_percentage` appear only when a discount is applied (backward compatible).

## Create QR Invoice (cashier display)

**Endpoint:** `POST /invoices/qr`

QR-code payment displayed on a cashier screen — without the customer's phone number. The cashier shows the QR; the customer scans it with the Kaspi app and pays. Built for offline points-of-sale, cash registers, and trade terminals.

Differences from `POST /invoices`:
- No `phone_number` required.
- Synchronous response — the QR (`qr_token_url` + ready PNG) is returned immediately.
- A QR invoice's lifecycle is measured in **minutes** (vs 24h for regular phone invoices). Kaspi dictates the exact expiry moment; the terminal status (`paid`/`cancelled`/`expired`) arrives via webhook. The `qr_expires_at` field is informational, not for local termination.
- Cancelling a QR invoice is not supported — if no payment arrives, the invoice flips to `expired` after a few minutes (on the terminal from Kaspi). A refund for a paid QR invoice goes through a separate branch, `POST /qr-refunds`: the customer scans a refund QR (see `openapi.yaml`).
- Per-org rate limit: **60 QR requests per minute per organization** (separate from the general API limit).

> ℹ️ **QR invoices coexist.** Creating a new QR on the same till does **not** cancel the previous ones — the old QR stays in `pending` and is monitored until its own terminal. React to `paid`/`cancelled`/`expired` per `invoice.id` separately (if several QRs are paid, you'll get several `paid` webhooks). Phone invoices live for 24h in Kaspi.

The request body depends on the organization's `has_catalog` setting:

### Request (no catalog)

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/qr \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "description": "Order #123",
    "external_order_id": "order-123"
  }'
```

### Request (with catalog)

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/qr \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Order #123",
    "cart_items": [
      {"catalog_item_id": 608400, "count": 2, "price": 1500}
    ],
    "discount_percentage": 10
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes* | Amount in KZT (only when has_catalog=false), 0.01 - 99,999,999.99 |
| `description` | string | No | Description (max 100). Used as the line item name on the Kaspi QR receipt |
| `external_order_id` | string | No | Your order ID (max 255) |
| `cart_items` | array | Yes* | Only when has_catalog=true. 1 to 100 items |
| `discount_percentage` | number | No | Whole-cart discount, 1-99% |
| `simulate` | string | No | Sandbox only: `paid` \| `cancelled` \| `expired`. See [Sandbox mode](#sandbox-mode) |

\* depends on `has_catalog`: either `amount` or `cart_items`.

### Response 201

```json
{
  "id": 63474,
  "amount": "100.00",
  "status": "pending",
  "paid_at": null,
  "phone": null,
  "created_at": "2026-05-09T07:27:37+00:00",
  "is_qr_token": true,
  "qr_token_url": "https://qr.kaspi.kz/0000000000000000000000000000000000000000",
  "qr_image_url": "https://api.apipay.kz/storage/qr/00000000-0000-0000-0000-000000000000.png",
  "qr_expires_at": "2026-05-09T07:32:38+00:00"
}
```

| Field | Description |
|-------|-------------|
| `id` | Invoice ID in our system. Use it to fetch status (`GET /invoices/{id}`); webhooks reference it too. |
| `is_qr_token` | QR-invoice flag. Also returned by `GET /invoices/{id}` and inside webhook payloads. |
| `qr_token_url` | Direct Kaspi URL (`qr.kaspi.kz/...`). Same payload as encoded in the PNG. You can re-render the QR on your side if you want a different style/size. |
| `qr_image_url` | Ready-made PNG 600×600 with the Kaspi logo in the center (ECC=High). Hosted on our CDN-storage, accessible without auth, lives until `qr_expires_at + 60s` (then returns 404). |
| `qr_expires_at` | The last moment at which the QR can still be **scanned** (UTC). Kaspi sets the window length — read it from this field rather than hard-coding a constant. The window limits scanning only: a payment started near the end of it completes after `qr_expires_at`. The terminal status is Kaspi's call — wait for the webhook, not for a local countdown. |

### Lifecycle and status handling

1. Created in status `pending`. The service tracks the status change on the Kaspi side itself.
2. On terminal status (`paid`, `cancelled`, `expired`) we send the regular `invoice.status_changed` webhook — same format as for regular invoices, but `invoice` contains `is_qr_token: true` and the QR fields.
3. Alternative poll: hit `GET /invoices/{id}` every 2-3 sec.
4. After a few minutes without payment the status becomes `expired` — but only once Kaspi returns the terminal (via webhook), not on a local timer. The PNG is removed from storage within ~1 minute — `qr_image_url` will start returning 404 (by design).
5. Cancelling a QR invoice is not supported — just wait for it to expire (a few minutes). A refund for a paid QR invoice is performed through the separate `POST /qr-refunds` branch — the customer scans a refund QR.

### Sandbox mode

If the organization has `sandbox_mode=true`, the endpoint works WITHOUT calling Kaspi: it returns a synthetic `qr_token_url` (`https://qr.kaspi.kz/sandbox/<uuid>`) and a real rendered PNG. You can display it in the UI and test the entire frontend logic, but the real Kaspi app will not accept this QR — it does not exist on Kaspi's side.

#### `simulate` parameter (sandbox only)

To quickly test terminal scenarios, pass `simulate` right inside the create payload — in a single call you get a ready, terminal-status invoice (no need for a separate `/simulate-status` call):

| `simulate` | Resulting `status` | `qr_expires_at` | `paid_at` | Webhook immediately? |
|------------|-------------------|-----------------|-----------|----------------------|
| (omitted) | `pending` | now + 5 min | `null` | no |
| `expired` | `expired` | now − 1 min (in the past) | `null` | yes |
| `paid` | `paid` | now + 5 min | now | yes |
| `cancelled` | `cancelled` | now + 5 min | `null` | yes |

- The parameter is silently ignored for non-sandbox organizations — production lifecycle is driven by Kaspi.
- Valid values go through standard validation; unknown values → 422.

##### Example: get an already-expired QR

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/qr \
  -H "X-API-Key: <sandbox_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 250, "simulate": "expired"}'
```

Response (excerpt):

```json
{
  "id": 63497,
  "status": "expired",
  "is_qr_token": true,
  "qr_token_url": "https://qr.kaspi.kz/sandbox/b5d6ffe9-…",
  "qr_image_url": "https://api.apipay.kz/storage/qr/b5d6ffe9-….png",
  "qr_expires_at": "2026-05-09T07:52:08+00:00"
}
```

`POST /api/v1/invoices/{id}/simulate-status` separately also works with QR invoices (for dynamic scenarios: create `pending` → wait in UI → explicitly flip to `paid`/`cancelled`/`expired`).

### Errors

| Code | error | When |
|------|-------|------|
| 400 | `organization_required` | API key has no organization |
| 400 | `kaspi_session_not_configured` | Organization has no connected Kaspi cashier (Settings → Kaspi authorization) |
| 400 | `Organization not found or not verified` | Production organization not in `verified` status |
| 400 | `sandbox_invoice_limit` | Sandbox invoice limit exceeded |
| 422 | `Validation failed` | Invalid params (see body schema) |
| 422 | `catalog_requires_cart_items` | `has_catalog=true` but `cart_items` not provided |
| 422 | `catalog_not_supported` | `has_catalog=false` but `cart_items` provided |
| 422 | — | The cart contains an item in the `deleting` status; the reason is in `errors["cart_items.N.catalog_item_id"]`, this branch has no separate `error_code`. Bring the item back or drop it from the cart, see [Catalog → Item Statuses](catalog.md#item-statuses) |
| 429 | `qr_rate_limit` | Per-org limit of 60 QR/min |
| 500 | `qr_render_failed` | Failed to render PNG |
| 502 | `kaspi_error` | Kaspi API returned an error |
| 503 | `kaspi_session_invalid` | Kaspi session expired |

> The two catalog-parity codes arrive in the **`error_code`** field, not in `error`, and without an `errors` object — only `message` sits next to them. The `message` texts did not change when the codes were added, so string parsing keeps working; move your branching to `error_code`.

## List Invoices

**Endpoint:** `GET /invoices`

```bash
curl "https://api.apipay.kz/api/v1/invoices?page=1&per_page=20&status[]=paid&sort_by=created_at&sort_order=desc" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 10 | Items per page (1-100) |
| `search` | string | — | Search in description/order ID |
| `status[]` | array | — | Filter by status |
| `date_from` | string | — | Window start, inclusive: `YYYY-MM-DD` (= the merchant's whole calendar day) or `YYYY-MM-DD HH:MM` (exact minute). Timezone — Asia/Almaty |
| `date_to` | string | — | Window end, inclusive, same format |
| `date_field` | string | created_at | Which field the window applies to: `created_at` or `paid_at` (the latter excludes unpaid invoices) |
| `sort_by` | string | created_at | Sort field |
| `sort_order` | string | desc | `asc` or `desc` |

## Get Invoice

**Endpoint:** `GET /invoices/{id}`

```bash
curl https://api.apipay.kz/api/v1/invoices/42 \
  -H "X-API-Key: YOUR_API_KEY"
```

> Response includes `items` array — snapshot of cart items at invoice creation: `[{ id, invoice_id, catalog_item_id, name, price, count, unit_id, original_price, discount }]`. Fields `subtotal`, `discount_sum`, `discount_percentage` appear at top level only when discount is applied.

**The `kaspi_qr_link` field** is a link for paying this invoice by QR, shaped like `https://kaspi.kz/qr/pay?tranId=QR…`. Draw a QR code from it for the customer. The field is also present in every `data` element of `GET /invoices`. It is computed from the Kaspi identifier and not stored, so it comes back `null` until Kaspi has assigned that identifier (the `processing` status), and it is always `null` in the sandbox.

> ⚠️ Do not confuse `kaspi_qr_link` with `qr_token_url`: the latter belongs to a separate mechanism, QR invoices (`POST /invoices/qr`).

## Kaspi Receipt for an Invoice

**Endpoint:** `GET /invoices/{id}/receipt`

Links to the Kaspi receipt of a paid invoice, so you can hand the receipt to the customer.

> This is the Kaspi receipt for an invoice payment. Fiscal receipts for cash and another bank's POS are a separate section, [Fiscal Receipts](receipts.md) (Kaspi OFD), unrelated to this endpoint.

```bash
curl https://api.apipay.kz/api/v1/invoices/42/receipt \
  -H "X-API-Key: YOUR_API_KEY"
```

**The response is asynchronous.** The first call schedules the fetch and answers `202`:

```json
{ "status": "pending", "poll_after": 2 }
```

Repeat the request after `poll_after` seconds — take the interval from the response, not from your own constant. Once the receipt is fetched, the same URL answers `200`:

```json
{
  "status": "ready",
  "receipt_link": "https://kaspi.kz/...",
  "download_link": "https://kaspi.kz/...&hash=...",
  "share_link": "https://kaspi.kz/...&hash=...",
  "sale_date": "2026-08-10 09:14:00.000000",
  "fetched_at": "2026-08-10T09:15:02+00:00"
}
```

`sale_date` comes exactly as Kaspi returned it (`YYYY-MM-DD HH:MM:SS.ffffff`), not as ISO 8601; the microseconds are significant — do not drop them. The other timestamps are ISO 8601.

A ready receipt is cached, so a repeat request for the same invoice answers immediately.

The three links differ in purpose: `share_link` is the one meant for the customer, `download_link` is the direct PDF for your own system, and `receipt_link` is the fiscal form of the receipt, safe to show anywhere.

> ⛔ `download_link` and `share_link` contain a secret `hash` parameter that opens the receipt for anyone holding the string. Do not publish them, do not write them to your logs and do not put them into the URLs of your own pages. We cannot revoke a link once issued: if it leaks, there is no way to close access. `receipt_link` carries no secret.

A receipt exists only for an invoice in the `paid` or `partially_refunded` status — a partial refund still leaves the invoice paid. There is no webhook for this event: request the receipt after the invoice becomes `paid`. In the sandbox the endpoint answers at once and the links are marked `sandbox=1` — they are stubs, there is no real receipt behind them, do not hand them to a customer.

**Errors:**

| Code | HTTP | When |
|------|------|------|
| `receipt_not_available_for_status` | 409 | The invoice is not `paid`/`partially_refunded`, or a paid invoice does not have a numeric Kaspi identifier yet |
| `kaspi_session_expired` | 409 | The cashier for this invoice needs reconnecting |
| `kaspi_session_unavailable` | 409 | The cashier is temporarily unavailable |
| `receipt_rate_limited` | 429 | The endpoint has its own per-minute limit, stricter than the general one |
| `receipt_unavailable` | 503 | Kaspi did not return the receipt — a retry a minute later usually helps |

## Cancel Invoice

**Endpoint:** `POST /invoices/{id}/cancel`

Invoices with `status: "pending"` or `"processing"` can be cancelled. In sandbox returns `200 OK` (synchronous), in production returns `202 Accepted` with status `cancelling` (async processing via Kaspi).

> ⛔ **A QR invoice (`is_qr_token: true`) cannot be cancelled** — the request answers `409 qr_cancel_unsupported` and the invoice status does not change. The response body carries `expires_at`, the moment after which the QR stops being payable. Wait for `expired` or issue a new invoice.

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response 202 (production)

```json
{
  "message": "Invoice cancellation queued",
  "invoice_id": 42
}
```

## Check Invoice Status

**Endpoint:** `POST /invoices/status/check`

Force-check the status of specified invoices. Accepts an array of invoice IDs (up to 100). Useful when webhooks are delayed.

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoice_ids` | array | Yes | Array of invoice IDs to check (max 100) |

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/status/check \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_ids": [42, 43, 44]
  }'
```

### Response

```json
{
  "invoices": [
    {
      "id": 42,
      "status": "paid",
      "kaspi_invoice_id": "ABC123",
      "amount": "5000.00",
      "error_message": null,
      "updated_at": "2026-02-26T10:30:00+06:00"
    }
  ]
}
```

## Refund Invoice

**Endpoint:** `POST /invoices/{id}/refund`

See [Refunds](refunds.md) for details.

## Invoice Refunds

**Endpoint:** `GET /invoices/{id}/refunds`

```bash
curl https://api.apipay.kz/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

## Invoice Statuses

| Status | Description | Can Cancel | Can Refund |
|--------|-------------|------------|------------|
| `processing` | Awaiting delivery to Kaspi | Yes | No |
| `pending` | Awaiting payment | Yes | No |
| `cancelling` | Being cancelled (async) | No | No |
| `paid` | Payment completed | No | Yes |
| `cancelled` | Manually cancelled | No | No |
| `expired` | Payment timeout | No | No |
| `error` | Delivery to Kaspi failed (see `error_message`) | No | No |
| `partially_refunded` | Partially refunded | No | Yes |

> There is no `refunded` status: a full refund does not change the status — the invoice stays `paid` (or `partially_refunded` if there was an earlier partial one), and a full refund is visible via `is_fully_refunded=true`.

## Status Flow

```
processing → pending → paid → partially_refunded
    ↓           ↓
  error    cancelling
                ↓
            cancelled

pending → expired
processing → cancelled (via cancel)
```

## Code Examples

### JavaScript

```javascript
const response = await fetch('https://api.apipay.kz/api/v1/invoices', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 10000,
    phone_number: '87001234567',
    description: 'Payment for order #123'
  })
})
const invoice = await response.json()
```

### Python

```python
import requests

response = requests.post(
    'https://api.apipay.kz/api/v1/invoices',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 10000, 'phone_number': '87001234567', 'description': 'Order #123'}
)
invoice = response.json()
```

### PHP

```php
$ch = curl_init('https://api.apipay.kz/api/v1/invoices');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 10000, 'phone_number' => '87001234567', 'description' => 'Order #123'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$invoice = json_decode(curl_exec($ch), true);
```
