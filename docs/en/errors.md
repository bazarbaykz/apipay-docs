# Error Codes

ApiPay.kz uses standard HTTP status codes with detailed error messages.

## HTTP Status Codes

| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 202 | Accepted | Request accepted for async processing |
| 400 | Bad Request | Malformed request or invalid state — see `message` or `error` |
| 401 | Unauthorized | API key missing, invalid, expired, or not linked to an organization; or the account is deactivated |
| 403 | Forbidden | Organization is suspended or not verified for production mode |
| 404 | Not Found | Resource not found, or belongs to another organization |
| 410 | Gone | Resource expired (e.g., verification timeout) |
| 422 | Validation Error | Field validation failed — details in the `errors` object |
| 429 | Too Many Requests | Rate limit exceeded (overall limit: 200/min per API key) — see the `Retry-After` header |
| 500 | Server Error | Internal server error |
| 502 | Bad Gateway | Error on the Kaspi API side |
| 503 | Service Unavailable | Kaspi session invalid or expired |

## Error Response Format

```json
{
  "message": "Error description",
  "errors": {
    "field_name": ["Specific error detail"]
  }
}
```

> Public API v1 errors are returned **as JSON regardless of the `Accept` header** — a bare `curl` sending `*/*` gets a parseable body too.

## Common Errors

### 401 Unauthorized

```json
{"message": "Invalid API key"}
```

**Solution:** Check your API key in dashboard Settings → Connection.

### 403 Forbidden

```json
{"message": "Organization not verified"}
```

**Solution:** Wait until the organization is verified, or test in the sandbox. If the Kaspi cashier is not connected yet, connect it in the dashboard (Settings → Kaspi Authorization); if the connection wizard fails, contact support.

### 422 Validation Error

```json
{
  "message": "Validation failed",
  "errors": {
    "phone_number": ["Phone number must be in format 8XXXXXXXXXX"],
    "amount": ["The amount of a phone-number invoice must be whole, from 1 KZT"]
  }
}
```

### 429 Too Many Requests

```json
{
  "message": "Too Many Requests"
}
```

### 502 Bad Gateway

```json
{"message": "Kaspi API error"}
```

**Solution:** Retry after a short delay. If persistent, contact support.

### 503 Service Unavailable

```json
{"message": "Kaspi session expired"}
```

**Solution:** Reconnect the Kaspi cashier in the dashboard (Settings → Kaspi Authorization), or contact support.

## Application Error Codes

When an invoice, refund, or subscription operation fails, the response body
contains an `error` field with one of the codes below. The stable snake_case
code is also delivered in the `error_code` field — build your logic on it, not
on the `message` text.

The **Delivery** column shows how a code reaches you: synchronously (sync — in
the HTTP response with the given status) and/or asynchronously (async — in a
webhook: the invoice moves to `error` with `invoice.error_code`, a refund to
`failed` with `refund.error_code`).

| Code | HTTP | Delivery | Meaning & resolution |
|------|------|----------|----------------------|
| `organization_required` | 400 | sync | Organization is not connected. Create a sandbox organization for testing, or connect a Kaspi cashier. |
| `Organization not found or not verified` | 400 | sync | Production mode: the organization is not verified. Wait for verification or test in the sandbox. |
| `kaspi_session_not_configured` | 400 | sync | The Kaspi cashier is not connected. Connect it in the dashboard (Settings → Kaspi Authorization) or via support. |
| `kaspi_session_invalid` | 503 | sync + async (`invoice.status_changed`, `status=error`) | The Kaspi cashier session expired or was reset. Reconnect the cashier and request a new SMS code. |
| `connection_ambiguous` | 422 | sync | The organization has several active cashier connections and no primary one. Pass `kaspi_connection_id`. |
| `sandbox_invoice_limit` | 400 | sync | Sandbox invoice limit reached per organization. Clear the sandbox in the dashboard. |
| `sandbox_subscription_limit` | 400 | sync | Sandbox subscription limit reached per organization. Clear the sandbox. |
| `qr_rate_limit` | 429 | sync | Too many QR requests for the organization (limit 60/min). Wait one minute. |
| `qr_render_failed` | 500 | sync + async (`invoice.status_changed`, `status=error`) | Failed to render the QR code image. Retry later. |
| `kaspi_error` | 502 | sync + async for QR invoices (`invoice.status_changed`, `status=error`) | Kaspi API returned an error. The reason text is in `message`/`error_message`. Retry later. |
| `client_not_found` | — | async (`invoice.status_changed`, `status=error`) | The phone number is not registered in Kaspi. Don't retry the same number — ask for another. |
| `network_unavailable` | — | async (`invoice.status_changed`, `status=error`) | The network/Kaspi was unavailable; retries are exhausted. Create a new invoice in 1–2 minutes. |
| `kaspi_throttled` | — / 429 | async (`invoice.status_changed`, `status=error`); sync on `POST /catalog/scan` | Kaspi rate-limited requests. For invoices, create a new one in 2–3 minutes. On `POST /catalog/scan` it is returned synchronously (HTTP 429): `retry_after_seconds` in the body, `Retry-After` header. Wait the given time and retry. |
| `kaspi_session_expired` | 400 | sync | The merchant's Kaspi session expired on `POST /catalog/scan`. Reconnect the Kaspi cashier and retry. |
| `kaspi_scan_unavailable` | 503 | sync | Kaspi's National Catalog is temporarily unavailable on `POST /catalog/scan`. Retry later. |
| `refund_window_expired` | — | async (`invoice.refunded`, `refund.status=failed`) | Kaspi rejected the refund: the refund window may have expired, or the refund was already made. Don't retry. |
| `refund_rejected_by_kaspi` | — | async (`invoice.refunded`, `refund.status=failed`) | Kaspi rejected the refund on this operation. The rejection may be temporary: it is worth retrying later, and if that fails, making the refund by hand in the Kaspi Pay app. ⛔ The server does not retry this refund on its own: the row is final at once, and a retry means a new refund request from your side. |
| `refund_requires_buyer_confirmation` | — | async (`invoice.refunded`, `refund.status=failed`) | This operation needs a QR refund: create one via `POST /qr-refunds` and show the QR to the buyer. |
| `Invoice cannot be cancelled` | 400 | sync | Only invoices in `pending` or `processing` status can be cancelled. |
| `qr_cancel_unsupported` | 409 | sync | A QR invoice (`is_qr_token: true`) cannot be cancelled: the status does not change and the body carries `expires_at`. Wait for `expired` or issue a new invoice. |
| `amount_must_be_whole_tenge` | 422 | sync (per item in `POST /invoices/bulk`) | The amount of a phone-number invoice must be whole: both `amount` and the cart total after discounts are checked. Round the amount or issue the invoice through `POST /invoices/qr`. |
| `Invoice is not refundable` | 400 | sync | Refunds are possible only for a paid invoice that is not yet fully refunded. |
| `Refund amount exceeds available amount` | 400 | sync | The refund amount is larger than available. See `available_for_refund` in `GET /invoices/{id}`. |
| `Organization not verified` | 403 | sync | Subscriptions in production mode are available only to a verified organization. |
| `kyc_daily_limit_reached` | 429 | sync | A young organization: until the business profile is approved, only 1 real invoice per day is allowed (Asia/Almaty window; sandbox invoices are not counted). `meta.reset_at` tells when the limit resets. Fill the short form in the dashboard (`/business-profile`); approval usually within 1 business day lifts the limit. |
| `kyc_rejected` | 403 | sync | Payment acceptance is closed following the business review. Not retryable — contact support if you believe this is a mistake. |
| `tariff_limit_reached` | 429 | sync | The invoice limit of the paid plan is reached — the invoice was NOT created. `meta` carries `mode` (`daily` — the billing day, `monthly` — a 30-day block), `limit`, `used`, `reset_at`; the body carries `retry_after_seconds` and the response has a `Retry-After` header. Do not retry before `reset_at`, or move to a higher plan. A one-off excess is not blocked; invoices created in the dashboard and sandbox invoices are not counted. |
| `cashier_unavailable` | 409 | sync | The cashier cannot be connected right now. The state is permanent — retrying will not help; show the user a neutral message and direct them to support. |
| `organization_identity_conflict` | 409 | sync | The Kaspi organization being connected does not match the one pinned to this organization, or that pair is already pinned to another one. Connecting a cashier does not by itself transfer ownership. The response deliberately does not reveal the other organization's details. If the business owner really changed, contact support at 77003076512. |
| `organization_identity_unavailable` | 502 | sync | Kaspi did not return reliable organization data. The connection is not blocked by this and any previously confirmed pair is kept: the sign-in attempt simply ends, so start over with a new code request. |
| `connection_identity_unverified` | 422 | sync | A connection that has not confirmed the organization's identity, or that is blocked, cannot be made the primary one. ⚠️ This refusal body carries only `error` and `message` — there is no `error_code` field. |
| `rate_limited` | 429 | sync | On `send-phone` — too many attempts to connect different cashier numbers. The window is daily: `Retry-After` and `retry_after_seconds` hold the seconds until the counter resets (hours, not minutes). Cashiers already connected are not counted, so re-authorizing a working point of sale does not hit the limit. |
| `file_too_large` | 413 | sync | The product image is larger than 6 MB (`POST /catalog/upload-image`). Retrying without shrinking the file is pointless. |
| `invalid_file_type` | 422 | sync | The file content is neither JPEG nor PNG. The type is detected from content, not from the extension or `Content-Type`: gif, webp, bmp and svg are rejected — convert them on your side. |
| `image_rejected` | 422 | sync | Image dimensions are out of range (sides 64…6000 px, area up to 12 MP) or the file is corrupted. |
| `image_processing_unavailable` | 500 | sync | Image processing is temporarily unavailable. The image is not saved and no `image_id` is issued — retrying is safe. |
| `webhook_url_requires_domain` | 422 | sync | The webhook URL must be on your own domain — IP addresses are not accepted (for not-yet-approved organizations in production; the rule is softer in the sandbox). |
| `webhook_url_tunnel_forbidden` | 422 | sync | Tunnels (ngrok and similar) cannot be used for production webhooks — they are temporary and will go offline. Use an address on your own domain. A tunnel is allowed in the sandbox for testing. |
| `fiscal_receipts_disabled` | 403 | sync | The fiscal receipts feature is disabled. Contact support to enable it. |
| `duplicate_client_operation_id` | 409 | sync | On issuing a receipt (`POST /receipts`) the `client_operation_id` was already used. The body carries `receipt_id`/`status` of the original receipt; a retry is allowed only after `failed`. |
| `receipt_preview_unavailable` | 503 | sync | Kaspi is temporarily unavailable for the receipt preview (`POST /receipts/preview`). Retry later. |
| `receipt_not_found` | 404 | sync | Receipt not found or belongs to another organization (`GET /receipts/{id}`). |
| `shift_closed` | — | async (`receipt.failed`, `status=failed`) | The shift in Kaspi Pos is closed. Open the shift in the Kaspi Pos app and issue the receipt again. |
| `item_not_fiscal` | — | async (`receipt.failed`, `status=failed`) | A receipt line item has no NTIN — it is not fiscal. Resolve the NTIN (`POST /catalog/scan` + `PATCH /catalog/{id}`) and retry. |
| `rfo_missing` | — | async (`receipt.failed`, `status=failed`) | The point of sale (RFO) for the receipt is not determined. Contact support. |
| `receipt_kaspi_error` | — | async (`receipt.failed`, `status=failed`) | Kaspi rejected issuing the receipt. The reason text is in `error_message`. |
| `receipt_dispatch_error` | — | async (`receipt.failed`, `status=failed`) | A technical dispatch failure. Retry with the same `client_operation_id`: no fiscal document was created, and after `failed` the previous key is released. |
| `receipt_ofd_token_revoked` | — | async (`receipt.failed`, `status=failed`) | The till's fiscal link to the OFD has been revoked. Taking payments keeps working; only receipts and catalog writes stop. The merchant must re-link the OFD in the Kaspi app — waiting does not fix it. See [Fiscal Receipts](receipts.md). |
| `receipt_not_available_for_status` | 409 | sync | `GET /invoices/{id}/receipt`: the invoice is not `paid`/`partially_refunded`, or a paid invoice has no numeric Kaspi identifier yet. |
| `receipt_rate_limited` | 429 | sync | `GET /invoices/{id}/receipt` has its own per-minute limit, stricter than the general one. Wait for `Retry-After`. |
| `receipt_unavailable` | 503 | sync | Kaspi did not return the invoice receipt. A retry a minute later usually helps. |
| `kaspi_session_unavailable` | 409 | sync | The cashier for this invoice is temporarily unavailable. Retry later. |
| `catalog_requires_cart_items` | 422 | sync | The organization has a catalog but `cart_items` were not sent. The body carries `message` and `error_code`, without `errors`. |
| `catalog_not_supported` | 400 / 422 | sync | The organization has no catalog. `422` when `cart_items` were sent anyway; `400` on `POST /catalog/bulk-delete`, where this is an organization precondition. |
| `catalog_item_not_found` | 422 / — | sync: `422` on single invoices, an entry in `invoices[]` with `status: failed` on `POST /invoices/bulk` | The cart item is unavailable: it belongs to another organization, has been removed (`deleted`), is queued for removal (`deleting`), or has no price. The exact reason comes as text in `errors["cart_items.N.catalog_item_id"]`, and in a batch — in the item's `message`. An item in `deleting` can be brought back with a regular `POST /catalog`, see [Catalog → Item Statuses](catalog.md#item-statuses). |
| `catalog_delete_scope_required` | 422 | sync | `POST /catalog/bulk-delete` with no target list, or with two lists at once. There is only one mode now: exactly one `ids[]` **or** `external_refs[]`. |
| `catalog_delete_owner_key_required` | 403 | sync | Bulk deletion requires a key issued by the organization owner. Reissue the key as the owner. |
| `catalog_bulk_delete_mismatch` | 409 | sync | The optional `expected_count` no longer matches the facts (`actual_count` in the body): the set changed between the `dry_run` and the command. Nothing was deleted — repeat the `dry_run`. |
| `catalog_multi_tradepoint` | 409 / — | sync on `POST /catalog/bulk-delete`; async on the item for `DELETE /catalog/{id}` | The organization has several trade points. Bulk deletion is refused synchronously (`409`, nothing changes). A single deletion is accepted with `202`, and the code appears on the item itself in `error_code`. Contact support. |
| `catalog_batch_filter_removed` | 422 | sync | The `batch_id` parameter was removed together with the batch aggregate and is now rejected explicitly — on `GET /catalog` and `GET /catalog/errors`. The rejection is triggered by the parameter being present at all: an empty `?batch_id=` returns `422` too. Select your items with a targeted `GET /catalog?external_refs[]=` or with the `from`/`to` window. |
| `catalog_match_overflow` | 422 | sync | Too many values in a targeted request or in a deletion list: no more than 200 values in total, and in a targeted `GET /catalog` no more than 1000 matched rows either. Split into batches. |
| `catalog_busy` | 409 | sync | The catalog is busy with another operation. Retry in a few seconds. |
| `idempotency_key_conflict` | 409 | sync | The `Idempotency-Key` is already taken by a different body or by another catalog operation — the key space is shared between uploads and bulk deletion. Take a new key; repeating with the same one will not help. |
| `custom_tariff_locked` | 409 | sync | The organization is on individually negotiated tariff terms: switching tiers is not self-service and is arranged with support. Renewing the same tier is not blocked. Detect the state up front via `is_custom` in `GET /tariff` and `can_change_tier` in the plan catalog. |
| `request_rate_limited` | 429 | sync | The per-minute request limit was exceeded. Do not confuse it with `rate_limited` — they are different codes. See [Rate Limiting](#rate-limiting). |
| `cashbox_disabled` | 403 | sync | Cash register operations are unavailable for the organization. |
| `cashbox_kkm_unknown` | 409 | sync | No Kaspi register (OFD) is linked to the Kaspi Pay account — the organization has no shifts. See [Cash register](cashbox.md). |
| `rfo_missing` (cash register) | 409 | sync | The same "no Kaspi register" signal for `GET /cashbox/summary` and both toggles. |
| `cashbox_no_open_shift` | — | async (`cashbox.shift_close_failed`) | There is no open shift — nothing to close. The code arrives in `operation.error_code`. |
| `cashbox_shift_already_closed` | — | — | The shift was already closed. It is not returned as a refusal: the operation finishes as `completed` — the target state is reached. |
| `cashbox_shift_not_found` | 404 | sync | A shift with this id is not available: `GET /cashbox/shifts` never returned it. |
| `cashbox_operation_not_found` | 404 | sync | No cash register operation with this id. |
| `cashbox_duplicate_operation` | 409 | sync | The `client_operation_id` of a shift closure is already used. ⚠️ The key is not released even after `failed` — repeat the closure with a new `client_operation_id`. |
| `cashbox_busy` | — | async (`cashbox.shift_close_failed`) | An operation on the register is already running. Repeat the closure with a new `client_operation_id`. |
| `cashbox_operation_failed` | — | async | The cash register operation failed (`cashbox.shift_close_failed`). |
| `cashbox_unavailable` | 503 | sync | The Kaspi register is temporarily unavailable. |
| `cashbox_report_unavailable` | 503 | sync | The shift report cannot be produced right now. Retry later. |
| `cashbox_toggle_in_progress` | 503 | sync | The toggle is already being switched. Retry later. |
| `cashbox_toggle_unavailable` | 503 | sync | The current value on the register could not be verified; the switch was not applied. |

> The `kaspi_session_not_configured` and `connection_ambiguous` codes (above) also apply
> to receipts: `POST /receipts` / `/receipts/preview` require an active cashier, and with
> several active cashiers — a `kaspi_connection_id`. See [Fiscal Receipts](receipts.md).

> A detailed "what the system does and what you should do" matrix for each
> asynchronous code lives in [Webhooks → Response scenarios](webhooks.md).

## Asynchronous Errors (Kaspi)

`POST /invoices` and `POST /invoices/qr` return `201 Created` with status
`processing`. The invoice is then sent to Kaspi asynchronously. If Kaspi
cannot process it, the status changes to `error` and the reason appears in
the `error_message` field — fetch it with `GET /invoices/{id}`.

Kaspi does not use fixed error codes; `error_message` contains plain text:

- **Phone not registered in Kaspi** — e.g. *"This phone number is not registered in Kaspi..."*. The customer has no Kaspi app — ask for a different number.
- **Temporary Kaspi failure** — e.g. *"Payment processing error..."* or *"Could not process the invoice after several attempts"*. Retry creating the invoice later.

## Error Handling Example

```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options)

  if (!response.ok) {
    const error = await response.json()

    switch (response.status) {
      case 401: throw new Error('Invalid API key')
      case 403: throw new Error('Organization not verified')
      case 422:
        const fields = Object.keys(error.errors || {}).join(', ')
        throw new Error(`Validation failed: ${fields}`)
      case 429: {
        const retry = Number(response.headers.get('Retry-After')) || 60
        if (options.__retried) throw new Error(`Rate limit exceeded, retry in ${retry}s`)
        await new Promise(r => setTimeout(r, retry * 1000))
        return apiRequest(url, { ...options, __retried: true }) // single retry
      }
      default:
        throw new Error(error.message || 'Unknown error')
    }
  }

  return response.json()
}
```

## Rate Limiting

- **Overall limit:** 200 requests per minute per API key
- **`POST /clients/check`:** 60 requests per minute and 10 000 per day per API key (separate counter)
- **`POST /catalog/scan`:** 30 requests per minute and 2000 per day per API key
- **QR invoices:** a separate limit of 60 requests per minute per organization (`POST /invoices/qr`)
- **`POST /catalog/bulk-delete`:** 10 requests per minute per API key
- **Cash register (`/cashbox/*`):** 30 requests per minute per API key
- **`GET /invoices/{id}/receipt`:** its own per-minute limit, stricter than the general one

### The `429` Body and Headers

A per-minute limiter refusal is machine-readable:

```json
{
  "message": "Too Many Attempts.",
  "error": "request_rate_limited",
  "error_code": "request_rate_limited",
  "limit": 200,
  "remaining": 0,
  "reset_at": "2026-08-13T09:31:00+00:00",
  "retry_after_seconds": 17
}
```

Headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` (always `0` on a `429`), `X-RateLimit-Reset` (the Unix time the window resets).

> ⚠️ The `message` field was deliberately left unchanged — `"Too Many Attempts."`. Integrations that parsed the string keep working; everything machine-readable was added alongside it.

> ⚠️ `limit` and `X-RateLimit-Limit` report the **most depleted bucket for this request**, not the limit of one particular endpoint: several limiters apply to a request at once.

Wait for `Retry-After` — do not hammer the endpoint. Tariff refusals (`tariff_limit_reached`) and quota refusals (`kyc_daily_limit_reached`) also arrive with `429`, but they are different codes with different handling: look at `error_code`, not at the status alone.
