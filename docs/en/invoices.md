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
| `amount` | number | Yes* | Amount in KZT, **whole tenge only**: 1 - 99,999,999. A fractional value → `422 amount_must_be_whole_tenge`; both `amount` and the `cart_items` total after discounts are checked. If you need tiyn, use `POST /invoices/qr` (but with a discount QR does not accept items priced in tiyn — `422 qr_discount_unsupported`). *Not required with cart_items. |
| `phone_number` | string | Yes | Customer phone (format: 8XXXXXXXXXX) |
| `description` | string | No | Payment description (max 60 chars — Kaspi shows the buyer only the first 60) |
| `external_order_id` | string | No | Your order ID (max 255 chars) |
| `buyer_bin` | string | No | The buyer's IIN/BIN — a string of exactly 12 digits, e.g. `"buyer_bin": "012345678901"`. Do not send it as a number — the leading zero is lost; otherwise `422` with `errors.buyer_bin`. Kaspi does not check the number — verify all 12 digits before sending. If the organization has a Kaspi register connected, the number goes into the Kaspi receipt. Returned in the create response, in `GET /invoices` and `GET /invoices/{id}`; it is not in webhooks. In `POST /invoices/bulk` the number is set per row (refusal — `errors.invoices.N.buyer_bin`) |
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
  "paid_at": null,
  "phone": "87001234567",
  "is_imported": false,
  "created_at": "2026-01-31T12:00:00+00:00",
  "subtotal": "10000.00",
  "discount_sum": "500.00",
  "discount_percentage": "10"
}
```

> **Note:** The payer's number in the response is the `phone` field (in the request — `phone_number`). The create response does not echo `description` and `external_order_id` — they are in `GET /invoices/{id}`. Conditional fields appear only when they have a value: `subtotal`, `discount_sum` and `discount_percentage` — with a discount or a cart, `buyer_bin` — if passed, `error_message` — in the `error` status. `is_imported: true` — a sale pulled in from the Kaspi history (made in the app, bypassing ApiPay).

`201` with `status: processing` is not an error: the final status (`pending` or `error`) arrives via the `invoice.status_changed` webhook or `GET /invoices/{id}`. Do not re-create an invoice that is in `processing`. To guard against duplicates on retry, use the `external_order_id_idempotency` field: a repeat answers `409 duplicate_idempotency_key` with the id of the earlier invoice.

## Create QR Invoice (cashier display)

**Endpoint:** `POST /invoices/qr`

QR-code payment displayed on a cashier screen — without the customer's phone number. The cashier shows the QR; the customer scans it with the Kaspi app and pays. Built for offline points-of-sale, cash registers, and trade terminals.

Differences from `POST /invoices`:
- No `phone_number` required.
- Synchronous response — the QR (`qr_token_url` + ready PNG) is returned immediately.
- A QR invoice's lifecycle is measured in **minutes** (vs 24h for regular phone invoices). Kaspi dictates the exact expiry moment; the terminal status (`paid`/`cancelled`/`expired`) arrives via webhook. The `qr_expires_at` field is informational, not for local termination.
- Cancelling a QR invoice is not supported — if no payment arrives, the invoice flips to `expired` after a few minutes (on the terminal from Kaspi). A refund for a paid QR invoice is the regular `POST /invoices/{id}/refund`, as for any invoice; if Kaspi requires the buyer's confirmation, issue them a link via `POST /qr-refunds/links` (see [Refunds → Fallback](refunds.md#fallback-a-link-to-the-buyer)).
- Per-org rate limit: **200 QR requests per minute per organization** — one counter for all of its keys, separate from the general API limit (200 requests per minute per key).

> ⚠️ **A QR invoice is for paying right away only.** Use `POST /invoices/qr` when the customer is next to you and pays now: the QR lives for a few minutes. If the customer will pay later, use a static QR (`POST /static-qr`) or a payment link (`POST /invoices/qr` with `static: true`). See «Which QR to choose» below.

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
| `discount_percentage` | integer | No | Discount percentage — **a whole number only**, 1–99; a fractional one → `422` with `errors.discount_percentage`. The discount of each line is rounded **up** to a whole tenge, see [QR discount](#qr-discount) |
| `buyer_bin` | string | No | The buyer's IIN/BIN — under the same rules as in `POST /invoices`: a string of exactly 12 digits, otherwise `422` with `errors.buyer_bin`. Not accepted with `static: true` (`422`). If the organization has a Kaspi register connected, the number goes into the Kaspi receipt |
| `simulate` | string \| object | No | Sandbox only: the string `paid` \| `cancelled` \| `expired` or the object `{"status": "error", "error_code": …}`. Not allowed with `static: true`. See [Sandbox mode](#sandbox-mode) |

\* depends on `has_catalog`: either `amount` or `cart_items`.

### QR discount

A discount on a QR invoice follows the Kaspi rule, not a plain «percentage of the total»:

- the percentage is a whole number only, from 1 to 99;
- the discount of each cart line = `price × quantity × percentage / 100`, rounded **up** to a whole tenge;
- the amount due is the sum of lines minus the sum of discounts.

So on a cheap item the actual discount is larger than stated — the Kaspi app calculates it the same way:

| Cart | Discount | Discount per line, ₸ | Amount due, ₸ |
|---|---|---|---|
| 5 ₸ × 1 | 10 % | 1 | 4 |
| 5 ₸ + 10 ₸ | 20 % | 1 + 2 | 12 |
| 5 ₸ + 10 ₸ | 7 % | 1 + 1 | 13 |
| 5 ₸ × 3 | 7 % | 2 | 13 |

Take the invoice amount from the response (`amount`, `discount_sum`), not from your own calculation. If you calculate it in advance, follow exactly this rule. A phone-number invoice (`POST /invoices`) calculates the discount differently, so do not keep one formula for both kinds of invoice.

A `422 qr_discount_unsupported` refusal means the discount cannot be applied to this cart; the invoice is not created, the same in the sandbox. Causes:

- an item price is set in tiyn — in `cart_items[].price` or in the catalog;
- the discount zeroes an item: 1 ₸ with a 10 % discount is a 1 ₸ discount.

The quantity in a cart line is at most 100,000 (`422` with `errors.cart_items.N.count`). The same discount rule applies to `static: true` and to the printed sheet `POST /static-qr`. For an item without `price`, the sheet and the payment link take the catalog price at payment time, not at issue: if it becomes fractional, a discounted sheet stops accepting payment. Set the price via `price` in the cart line, in whole tenge. A sheet with a cart and a discount is paid by QR only: its page has no payment by phone number. On a sheet without a cart (with `amount`) the discount does not apply.

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
| `is_qr_token` | QR-invoice flag. Also returned by `GET /invoices/{id}`; it is not in the webhook body. |
| `qr_token_url` | The Kaspi link to this QR invoice. Same payload as encoded in the PNG: it can be opened on the buyer's phone instead of scanning, or re-rendered as a QR in your own style. It lives as long as the QR — do not send it «for later». |
| `qr_image_url` | Ready-made PNG 600×600 with the Kaspi logo in the center (ECC=High). Hosted on our CDN-storage, accessible without auth, lives until `qr_expires_at + 60s` (then returns 404 — issue a new invoice). The same address comes in `GET /invoices/{id}`. |
| `qr_expires_at` | The last moment at which the QR can still be **scanned** (UTC). Kaspi sets the window length — read it from this field rather than hard-coding a constant. The window limits scanning only: a payment started near the end of it completes after `qr_expires_at`. The terminal status is Kaspi's call — wait for the webhook, not for a local countdown. |

### Lifecycle and status handling

1. Created in status `pending`. The service tracks the status change on the Kaspi side itself.
2. On terminal status (`paid`, `cancelled`, `expired`) we send the regular `invoice.status_changed` webhook — same format as for regular invoices. It carries no QR fields and no `is_qr_token`: if you need them, read `GET /invoices/{id}`.
3. Alternative poll: hit `GET /invoices/{id}` every 2-3 sec.
4. After a few minutes without payment the status becomes `expired` — but only once Kaspi returns the terminal (via webhook), not on a local timer. The PNG is removed from storage within ~1 minute — `qr_image_url` will start returning 404 (by design).
5. Cancelling a QR invoice is not supported — just wait for it to expire (a few minutes). A refund for a paid QR invoice is `POST /invoices/{id}/refund`; if it is refused with a demand for the buyer's confirmation — a link via `POST /qr-refunds/links` with `source_refund_id`. The immediate `POST /qr-refunds` with a QR at the till is deprecated.

### Which QR to choose

| Situation | What to issue |
|---|---|
| The customer is next to you and pays right now | QR invoice: `POST /invoices/qr` |
| The customer will pay later: wants to think, gets a link in a messenger, pays from paper | Static QR (`POST /static-qr`) or a payment link (`POST /invoices/qr` with `static: true`) |

- **A QR invoice lives for a few minutes.** Kaspi sets the exact window, and it arrives in `qr_expires_at`. If the customer does not make it in time, the invoice becomes `expired` and a new QR is needed to pay.
- **In live mode every issued QR invoice takes a slot in the daily plan limit** — in any status, including one that expired unpaid and every re-created one; the slot is not returned. On systematic excess, creation is rejected with `429 tariff_limit_reached`.
- **With a static QR or a payment link, the invoice is created only when the customer taps «Оплатить в Kaspi» (Pay in Kaspi).** While the customer is thinking, no slot in the limit is taken.
- **After «Оплатить в Kaspi» (Pay in Kaspi) is tapped, the issued Kaspi QR takes a slot in the limit too.** For a single-use code (the default; a payment link is always single-use), tapping again while that QR is still valid and not scanned returns the same QR. For a reusable static QR (`single_use: false`), every tap issues a new invoice, and each one takes a slot in the limit. If the QR has expired, a new invoice is issued — and it takes another slot.

> 💡 **Rule for AI agents and integrators.** `POST /invoices/qr` without `static` — only if the customer pays right away. For paying «later» — a static QR (`POST /static-qr`) or a payment link (`POST /invoices/qr` with `static: true`). Do not re-create a QR invoice on a timer while waiting for the customer.

### Sandbox mode

If the organization has `sandbox_mode=true`, the endpoint works WITHOUT calling Kaspi: `qr_token_url` leads to an ApiPay test page (`https://qr.apipay.kz/sandbox/…`) that shows the invoice amount, description and status, and the PNG is really rendered and encodes the same address. You can display it in the UI and test the entire frontend logic, but such an invoice cannot be paid in Kaspi. Do not parse the address path — its format is not part of the contract; the sandbox flag is `is_sandbox`. Without `simulate`, a sandbox QR expires on its own after `qr_expires_at` (status `expired` and a webhook).

#### `simulate` parameter (sandbox only)

To quickly test terminal scenarios, pass `simulate` right inside the create payload — in a single call you get a ready, terminal-status invoice (no need for a separate `/simulate-status` call):

| `simulate` | Result | Webhook |
|------------|--------|---------|
| (omitted) | `pending`; after `qr_expires_at` the invoice becomes `expired` on its own | on expiry |
| `expired` | `expired` | yes |
| `paid` | `paid` | yes |
| `cancelled` | `cancelled` | yes |

The object `{"status": "error", "error_code": "kaspi_error" | "qr_render_failed" | "kaspi_session_invalid"}` gives a synchronous refusal with the same responses as in production (`502`, `500`, `503`) and an `error` webhook.

- For a production organization the string value is silently ignored, and the object is rejected with `422`.
- Not allowed with `static: true`. Unknown values → 422.
- All the ways to request an outcome — [Sandbox](sandbox.md).

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
  "qr_token_url": "https://qr.apipay.kz/sandbox/…",
  "qr_image_url": "https://api.apipay.kz/storage/qr/….png",
  "qr_expires_at": "2026-05-09T07:52:08+00:00"
}
```

`POST /invoices/{invoice}/simulate-status` separately also works with QR invoices (for dynamic scenarios: create `pending` → wait in UI → explicitly flip to `paid`/`cancelled`/`expired` or simulate a `qr_scanned` scan).

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
| 422 | `qr_discount_unsupported` | The discount cannot be applied to the cart: an item priced in tiyn or a discount that zeroes an item. The code arrives in both `error` and `error_code`, the reason text is in `errors.discount_percentage`. The invoice is not created. See [QR discount](#qr-discount) |
| 422 | — | The cart contains an item in the `deleting` status; the reason is in `errors["cart_items.N.catalog_item_id"]`, this branch has no separate `error_code`. Bring the item back or drop it from the cart, see [Catalog → Item Statuses](catalog.md#item-statuses) |
| 429 | `qr_rate_limit` | Per-org limit of 200 QR/min, no `Retry-After` — retry in about a minute |
| 500 | `qr_render_failed` | Failed to render PNG |
| 502 | `kaspi_error` | Kaspi API returned an error |
| 503 | `kaspi_session_invalid` | Kaspi session expired |

> The two catalog-parity codes arrive in the **`error_code`** field, not in `error`, and without an `errors` object — only `message` sits next to them. The `message` texts did not change when the codes were added, so string parsing keeps working; move your branching to `error_code`.

## Payment link and printed QR

For paying «later» — when the buyer wants to think, gets a link in a messenger or pays from paper:

- **Payment link** — `POST /invoices/qr` with `static: true`. The response carries `payment_url` (send it to the buyer or put it behind a button on your site) and `static_qr_id`. An active plan is required. A repeat with the same `external_order_id_idempotency` answers `409 idempotency_conflict` with the same link.
- **Printed sheet** — `POST /static-qr`. The response carries `print_url` (the sheet address encoded in its QR), `short_code` for manual entry, `qr_image_url` and `payment_url` — a payment link for the same deal. To disable — `DELETE /static-qr/{id}`: new scans show «inactive», invoices already created are not touched.

**There is no invoice at issue time.** `static_qr_id` is not an invoice ID; do not pass it to `GET /invoices/{id}`. An invoice — a payment attempt — is created only when the buyer taps «Оплатить» (Pay) on the page; opening the page and a messenger preview do not create an invoice. One link or sheet can have several attempts.

### Plan limit

| Action | Slot in the daily limit |
|---|---|
| `POST /invoices`, `POST /invoices/qr`, each row of `POST /invoices/bulk`, each invoice of a subscription created via the API | takes one — in any status, the slot is not returned |
| Issuing a `static: true` link or a `POST /static-qr` sheet | does not take one |
| Opening the link or sheet page, a messenger preview | does not take one |
| Tapping «Оплатить» (Pay) on the page (a new attempt) | takes one — each attempt |
| Sandbox, invoices from the dashboard | do not take one |

Every invoice created with your key uses the limit — paid, expired, cancelled or with an error. While the buyer is thinking over a link or sheet, no slot is taken; each attempt after a «Оплатить» (Pay) tap takes one. For a single-use link or sheet, tapping again while the issued QR is still valid and not scanned does not create a new invoice; for a reusable sheet (`single_use: false`) every tap is a new invoice. If the QR expired unscanned, the open page issues a new invoice on its own, without a tap — and it takes a slot too. The plan limit is up to 30, up to 100, up to 300 or up to 600 invoices a day depending on the plan; usage is shown in `GET /tariff` → `daily_usage`. On systematic excess, creation is rejected with `429 tariff_limit_reached`. While such a restriction is in effect, a subscription created via the API does not issue the invoice for the period: the next invoice date does not move, and missed periods are not caught up.

### How to match a payment to an order

The payment arrives as an `invoice.status_changed` webhook of an attempt whose `invoice.id` is not known in advance:

1. Find the order by `invoice.static_qr_id` (synonym `static_qr_code_id`), then by `external_order_id`. On the first payment, save `invoice.id` — refunds are made by it.
2. `expired`, `cancelled` and `error` of an attempt **do not cancel the order**: the link or sheet is alive, and the buyer can tap «Оплатить» (Pay) again. An attempt expiring is not an order cancellation.
3. The same `invoice.id` with the same status is a repeated delivery. **A different `invoice.id` of the same link with status `paid` is the buyer's second payment**, not a duplicate: refund it (`POST /invoices/{id}/refund` on that attempt) or hand it over to a person for review.
4. There is no notification about the link itself expiring: your application tracks the order deadline.

For reconciliation, `GET /invoices?static_qr_id={id}` returns all attempts of one link or sheet, and `GET /static-qr/{id}` gives the outcome. In the sandbox, an attempt is created by `POST /static-qr/{id}/simulate` (see [Sandbox](sandbox.md)).

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
| `status[]` | array | — | Filter by status, including `status[]=error` |
| `date_from` | string | — | Window start, inclusive: `YYYY-MM-DD` (= the merchant's whole calendar day) or `YYYY-MM-DD HH:MM` (exact minute). Timezone — Asia/Almaty |
| `date_to` | string | — | Window end, inclusive, same format |
| `date_field` | string | created_at | Which field the window applies to: `created_at` or `paid_at` (the latter excludes unpaid invoices) |
| `static_qr_id` | integer | — | All attempt invoices of one payment link or printed sheet |
| `sort_by` | string | created_at | Sort field |
| `sort_order` | string | desc | `asc` or `desc` |

## Get Invoice

**Endpoint:** `GET /invoices/{id}`

```bash
curl https://api.apipay.kz/api/v1/invoices/42 \
  -H "X-API-Key: YOUR_API_KEY"
```

> Response includes `items` array — snapshot of cart items at invoice creation: `[{ id, invoice_id, catalog_item_id, name, price, count, unit_id, discount, barcode, ntin, gtin }]`. Fields `subtotal`, `discount_sum`, `discount_percentage` — the pre-discount total and the discount, `null` when there is no discount and no cart. A QR invoice has `qr_image_url` — the absolute address of the QR image (`qr_image_path` is kept for compatibility). A payment attempt via a link or sheet has `static_qr_id`.

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

Invoices with `status: "pending"` or `"processing"` can be cancelled. An invoice not yet passed to Kaspi (no `kaspi_invoice_id`) is cancelled synchronously — `200` and a `cancelled` webhook. An invoice already passed to Kaspi — `202 Accepted` with status `cancelling`: do not treat it as cancelled right away, the outcome arrives via webhook. If Kaspi refuses, the invoice returns to `pending` without a webhook; the current status arrives with the next webhook or is visible in `GET /invoices/{id}`. **The sandbox cancels the same way as production**; there, the cancellation outcome is requested with the `simulate` field (see [Sandbox](sandbox.md)).

> ⛔ **A QR invoice (`is_qr_token: true`) cannot be cancelled — neither in production nor in the sandbox:** the request answers `409 qr_cancel_unsupported` and the invoice status does not change. The response body carries `expires_at`, the moment after which the QR stops being payable. Wait for `expired` or issue a new invoice. A payment link (`static: true`) and a printed sheet are disabled with `DELETE /static-qr/{id}`.

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response 202

```json
{
  "message": "Invoice cancellation queued",
  "invoice_id": 42
}
```

## Check Invoice Status

**Endpoint:** `POST /invoices/status/check`

Force-check the status of specified invoices. Accepts an array of invoice IDs (up to 100). Useful when webhooks are delayed. Works in the sandbox too.

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
cancelled → paid, expired → paid (last-moment payment)
error → pending (reconciliation found a live invoice)
```

The sequences `cancelled → paid`, `expired → paid` and `error → pending` are legitimate and arrive via webhook — do not close an order for good on `cancelled`, `expired` or `error`. If after `error` you have already issued a new invoice for the order and the old one returned to `pending`, cancel one of them. More — [Webhooks → Status transitions](webhooks.md#status-transitions).

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
