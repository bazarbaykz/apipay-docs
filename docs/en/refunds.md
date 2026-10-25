# Refunds

Full and partial refunds for paid invoices. A refund is asynchronous: a `201` response with `status: pending` means "the request was accepted", not "the money is back". The outcome arrives as an `invoice.refunded` webhook (`completed` or `failed`) and is visible in `GET /invoices/{id}/refunds`.

## Create Refund

**Endpoint:** `POST /invoices/{id}/refund`

### Full Refund

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Idempotency-Key: refund-order_123-1" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer request", "hold_for_buyer_confirmation": true}'
```

### Partial Refund

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Idempotency-Key: refund-order_123-2" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "reason": "Partial return", "hold_for_buyer_confirmation": true}'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | No | Partial refund amount (0.01-99999999.99). Omit for a full refund. |
| `reason` | string | No | Refund reason (max 255 characters; longer — `422` with the error in `errors.reason`) |
| `return_items` | array | No | Items for an itemized refund from the cart. For each item set EXACTLY one of: `count` (whole units) OR `amount` (an arbitrary amount for the item). Both or neither is a 422 error. |
| `hold_for_buyer_confirmation` | boolean | No | Hold until the buyer confirms (default `false`). If Kaspi refuses with `refund_requires_buyer_confirmation` or `refund_rejected_by_kaspi`, the invoice stays reserved for this refund, and only a buyer link carrying its `source_refund_id` can go through. For integrations — always `true`, see [Fallback](#fallback-a-link-to-the-buyer). |
| `idempotency_key` | string | No | Idempotency key in the body — the same as the `Idempotency-Key` header (up to 191 characters). If both are sent, the header wins. |

The `Idempotency-Key` header — see [Idempotency and retries](#idempotency-and-retries).

### Itemized Refund (cart)

For each item — either `count` (refund whole units, amount = `price × count`) or `amount` (refund an arbitrary part of the item's cost, e.g. for an indivisible service with `count: 1`). Items of both kinds can be mixed in one request.

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Idempotency-Key: refund-order_123-3" \
  -H "Content-Type: application/json" \
  -d '{
    "return_items": [
      { "catalog_item_id": 101, "count": 2 },
      { "catalog_item_id": 205, "amount": 19750 }
    ],
    "reason": "Part of the order returned",
    "hold_for_buyer_confirmation": true
  }'
```

> For an item refunded by `amount`, the response and the `invoice.refunded` webhook show `refund.items[].count = 0`, with the sum in `amount`. This is expected.

### Response

`201` — the refund was accepted and queued:

```json
{
  "message": "Refund queued for processing",
  "refund": {
    "id": 1,
    "invoice_id": 42,
    "amount": "5000.00",
    "status": "pending",
    "reason": "Partial return",
    "created_at": "2026-01-31T14:00:00+00:00",
    "idempotency_key": "refund-order_123-2",
    "buyer_hold": "held"
  },
  "invoice": {
    "id": 42,
    "amount": "10000.00",
    "total_refunded": "0.00",
    "pending_refund_amount": 5000,
    "available_for_refund": 5000
  }
}
```

`200` with `idempotent_replay: true` — a repeat of the same request with the same key: the same refund in its current status, nothing new created. `buyer_hold`: `held` — the hold was chosen, `released` — lifted by a staff member in the ApiPay dashboard, `null` or no field — no hold was chosen.

## Idempotency and retries

- **Send `Idempotency-Key`** — your own key for each refund request, for example `refund-order_123-1`. Store it next to the order before sending the request. The key space is the invoice; keys are case-sensitive.
- **Lost response (timeout, dropped connection) — retry only with the same key and the same body.** The retry returns `200` with `idempotent_replay: true` and the same refund: no second refund, no new request to Kaspi, no repeated webhook. The replay is recognized before the busy and balance checks, so a retry after your own success will not get "nothing to refund".
- **Without a key the retry is not recognized:** while the first refund is running you get `409 qr_refund_link_invoice_busy`, and after it a partial refund goes through a second time. Without a key, read `GET /invoices/{id}/refunds` first.
- **The same key with a different body** — `409 idempotency_key_conflict`: take a new key.
- **A new key — only for a new request.** After a final `failed`, fix the cause and send the refund with a new key: the old key returns the previous `failed`.

## List All Refunds

**Endpoint:** `GET /refunds`

```bash
curl "https://api.apipay.kz/api/v1/refunds?page=1&per_page=20&status[]=completed" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (1-100, default: 10) |
| `status[]` | array | Filter: `pending`, `processing`, `completed`, `failed` |
| `invoice_id` | integer | Filter by invoice ID |
| `date_from` | string | Window start, inclusive: `YYYY-MM-DD` (= the merchant's whole calendar day) or `YYYY-MM-DD HH:MM`. Zone — Asia/Almaty; the window is cut by the refund operation time |
| `date_to` | string | Window end, inclusive, same format |

### Response

```json
{
  "data": [
    {
      "id": 5,
      "invoice_id": 42,
      "amount": "5000.00",
      "reason": "Product return",
      "status": "completed",
      "kaspi_refund_id": "REF-123456",
      "kaspi_status": "completed",
      "initiated_by": "api",
      "error_message": null,
      "created_at": "2026-01-31T12:00:00+00:00",
      "invoice": {
        "id": 42,
        "external_order_id": "ORDER-100",
        "amount": "10000.00",
        "status": "partially_refunded",
        "kaspi_invoice_id": "KSP-789"
      },
      "items": [
        {
          "id": 1,
          "refund_id": 5,
          "invoice_item_id": 10,
          "catalog_item_id": 101,
          "name": "Product A",
          "price": "2500.00",
          "count": 2,
          "amount": "5000.00"
        }
      ]
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 10,
    "total": 25
  }
}
```

`initiated_by` — who started the refund: `api`, `dashboard` or `system` (a row that synchronization created for an executed operation, for example after a refund through a buyer link).

## Invoice Refunds

**Endpoint:** `GET /invoices/{id}/refunds`

```bash
curl https://api.apipay.kz/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

This answers "what happened to the order's money", and it is the endpoint to poll regularly for reconciliation: a webhook may not arrive, while this list shows the outcome.

| Field | Description |
|-------|-------------|
| `invoice.available_for_refund` | How much can still be refunded (a number, not a string). It accounts for a link refund not yet picked up by synchronization and for unfinished refunds, so it can be less than `amount − total_refunded`. The same value comes in the `POST /invoices/{id}/refund` response |
| `invoice.refund_in_progress` | The invoice is busy: there is an unfinished or unresolved refund, a live buyer link or a hold. While `true`, a new refund and a new link get `409 qr_refund_link_invoice_busy` |
| `refunds[].operation_state` | The state of the refund operation together with the link it produced — see the table below |
| `refunds[].successor_refund_id` | The refund row that synchronization created for the buyer link issued for this refund. Count the money once — by the successor |
| `refunds[].resolved_refund_id` | Resolving an unknown outcome found the same Kaspi operation already recorded as a separate row: the id of that row |
| `qr_refund_sessions` | "Возврат ApiPay" buyer links for this invoice, with `source_refund_id`. The link address is not included |

| `operation_state` | Meaning |
|---|---|
| `processing` | Queued or running |
| `completed` | The money is back — by a direct refund or by a link for it |
| `failed` | Refused, the money did not move |
| `awaiting_buyer` | Kaspi requires the buyer, and there is no link for the refund yet or all have expired — issue a link |
| `buyer_link_active` | A link for the refund has been issued and is alive |
| `uncertain` | The outcome is not proven, the money may have gone: do not retry |
| `released` | The hold was lifted, and there is no completed, unresolved or live link for the refund |

## Refund Statuses

| Status | Description |
|--------|-------------|
| `pending` | Refund initiated, waiting for processing |
| `processing` | Being processed by Kaspi |
| `completed` | Completed successfully |
| `failed` | Failed (e.g. rejected by Kaspi) |

### Why a refund failed

For a `failed` refund the reason comes as a code in `error_code` — in `GET /invoices/{id}/refunds` and in the `invoice.refunded` webhook (`refund.error_code`):

| Code | Meaning | What to do |
|------|---------|------------|
| `refund_requires_buyer_confirmation` | Kaspi requires the buyer's confirmation for this operation | Issue a link to the buyer: `POST /qr-refunds/links` with `invoice_id` and this refund's `source_refund_id` — see [Fallback](#fallback-a-link-to-the-buyer) |
| `refund_rejected_by_kaspi` | Kaspi rejected the refund for this operation | The same: a buyer link with `source_refund_id`. If the refund was created without the hold, it can also be retried later with a new `Idempotency-Key`. If the buyer cannot be reached, first revoke the live links for the invoice (`DELETE /qr-refunds/links/{id}`; the `id` is in `qr_refund_sessions` of the `GET /invoices/{id}/refunds` response). A link issued without `source_refund_id` is visible only there: it has no `operation_state` of its own. Revoking does not stop a scan window that is already open: wait for it to end and re-read the list. Money for the invoice can still go out while a refund has `operation_state` `processing` or `buyer_link_active`, or a link has status `awaiting_customer`, `activating`, `awaiting_scan`, `customer_identified` or `executing`; with `uncertain` on a refund or `execution_uncertain` on a link it may already have gone. None of these states may remain on the invoice: resolve `uncertain` and `execution_uncertain` in the ApiPay dashboard first. This refund must not have become `completed`, and no new `completed` record may have appeared on the invoice since the rejection — that is how a completed link without `source_refund_id` shows up. Only then refund manually in the Kaspi Pay app — otherwise the buyer gets the money a second time. After a manual refund, record it in your system and do not issue a link for this refund again, even if reconciliation shows `awaiting_buyer`; if the refund was created with the hold, lift it in the ApiPay dashboard. |
| `refund_insufficient_funds` | The Kaspi Pay account did not have enough money for the refund | Do not issue a link — it will not help. Top up the account and send a new refund with a new key |
| `refund_window_expired` | Kaspi rejected the refund: the refund period may have expired, or the refund was already made. Arrives only by webhook: creating a refund has no synchronous `422` | Do not retry, do not issue a link |
| `refund_resolved_not_executed` | An unknown outcome was resolved: the money did not go | The invoice is free; if needed, a new refund with a new key |
| `refund_resolved_executed` | An unknown outcome was resolved: the money went and is accounted for by the `resolved_refund_id` row | Do not create a new refund — the buyer already has the money |

> ⛔ The server does not retry a failed refund on its own: a `failed` row is final right away. A retry is a new request with a **new** `Idempotency-Key`, and only for codes where it makes sense.

Full list of codes — [Error codes](errors.md).

### Unknown outcome — do not retry

⛔ A refund in `processing` with `error_code: refund_execution_uncertain` (in `GET /invoices/{id}/refunds` it has `operation_state: uncertain`) — the outcome of the money request is not proven, the money may have gone. Do not repeat the refund — not by request, not by a buyer link, not manually in the Kaspi Pay app: if the money already went, a manual refund pays the buyer a second time.

The outcome is marked by the owner or developer of the organization on the invoice card in the ApiPay dashboard, after checking the operation history in Kaspi Pay; if unsure — ApiPay support. Until the outcome is marked, the invoice is busy (`409 qr_refund_link_invoice_busy`) and no webhook comes. After resolution the refund becomes `failed` with `refund_resolved_not_executed` (an `invoice.refunded` arrives) or `refund_resolved_executed` (no webhook for the original refund — read its status in `GET /invoices/{id}/refunds`).

## Fallback: a link to the buyer

Sometimes Kaspi does not allow refunding right away: the refund ends `failed` with `refund_requires_buyer_confirmation` or `refund_rejected_by_kaspi`. Then the application itself issues a "Возврат ApiPay" (ApiPay refund) link to the buyer: the buyer opens it and confirms the refund, and the refund is executed automatically.

1. Create refunds with `hold_for_buyer_confirmation: true`. On a refusal with these codes the invoice stays reserved for the refund: another refund and another link for it get `409 qr_refund_link_invoice_busy`, and only a link with its `source_refund_id` goes through. Without the flag, a refusal does not hold the invoice.
2. On `invoice.refunded` with `status: failed` and one of the two codes — or on `operation_state: awaiting_buyer` during reconciliation — issue a link:

```bash
curl -X POST https://api.apipay.kz/api/v1/qr-refunds/links \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": 42, "source_refund_id": 6}'
```

3. The server takes the amount, items and reason from the refused refund: `amount` and `return_items` are not sent together with `source_refund_id`.
4. The `201` response carries `customer_url`. It is returned **exactly once** and cannot be retrieved again — not via `GET /qr-refunds/{id}`, not in any other way. The link works for whoever holds it: whoever opens it confirms the refund. Do not write the address to logs, analytics or tickets; deliver it to the buyer right away. An unactivated link lives until `link_expires_at` (24 hours).
5. A link for an invoice executes the refund by itself, after the buyer confirms. `POST /qr-refunds/{id}/execute` is not needed for it (it is for a link without `invoice_id`); the immediate `POST /qr-refunds` is deprecated. The outcome arrives as `qr_refund.*` webhooks: `completed`, `failed` (including after `qr_refund.identified`), `expired`, `execution_uncertain` — see [Webhooks](webhooks.md). On `execution_uncertain` repeat nothing — not by request, not with a new link, not by hand in the Kaspi Pay app: contact ApiPay support.
6. After `qr_refund.completed`, an `invoice.refunded` with `status: completed` and a **different** `refund.id` may arrive — the row that synchronization created for the same operation. It is the same money, not a second refund: the original refund in `GET /invoices/{id}/refunds` gets a `successor_refund_id` equal to this id.

For other refusals (`refund_insufficient_funds`, `refund_window_expired`) do not issue a link — show the reason to the operator.

**A new link for the same refund.** One refused refund — one sum of money. While it has a live link or a link with an unknown outcome, a new one is refused: the invoice is busy — `409 qr_refund_link_invoice_busy`; the source is already used — `422` with `errors.source_refund_id`. An expired or failed link releases the source — then a new link is issued (`201`). An unactivated link can be revoked: `DELETE /qr-refunds/links/{id}`; after the buyer has confirmed — `409 qr_refund_link_not_revocable`.

A staff member can lift the hold in the ApiPay dashboard — the invoice is then freed, and the refund gets `operation_state: released`.

## Reconciliation

A webhook may not arrive: delivery is not guaranteed, and while sending is paused, refund events are not sent later (see [Webhooks → Delivery](webhooks.md#delivery)). So for every unfinished refund, read `GET /invoices/{id}/refunds` periodically and act on `operation_state`: `awaiting_buyer` — issue a link, `uncertain` — hand it to the organization's owner or developer: the outcome is marked on the invoice card in the ApiPay dashboard and will not resolve on its own; `completed` — mark the refund in the order.

## Refund Rules

1. **Paid invoices only** — invoices with status `paid` or `partially_refunded` can be refunded
2. **Multiple partial refunds** — several partial refunds are allowed up to the original amount
3. **Amount validation** — the amount cannot exceed `available_for_refund` (in `GET /invoices/{id}/refunds` and in the `POST /invoices/{id}/refund` response)
4. **One unfinished refund per invoice** — while a refund is running for the invoice, or there is a buyer link or a hold, a new refund gets `409 qr_refund_link_invoice_busy`
5. **A connected Kaspi cashier is required** — the refund goes through the connected cashier. If the cashier is disconnected, the money cannot be refunded via the API — the refund is made manually in the Kaspi Pay app.

## Sandbox

The outcome of a sandbox invoice refund is requested with the `simulate` field: `{"status": "completed"}`, `{"status": "failed", "error_code": "refund_requires_buyer_confirmation"}` (the production code and an `invoice.refunded` webhook) or `{"status": "uncertain"}` (unknown outcome, no webhook). A refusal with a hold holds the invoice, as in production. An unknown outcome is resolved by `POST /invoices/{invoice}/refunds/{refund}/simulate-resolve`, the hold is lifted by `POST /invoices/{invoice}/refunds/{refund}/simulate-release-hold`. The buyer's steps on the link — `POST /qr-refunds/{id}/simulate`. More — [Sandbox](sandbox.md).

## Code Examples

### JavaScript

```javascript
// Full refund: your own key per request, hold until the buyer confirms
await fetch('https://api.apipay.kz/api/v1/invoices/42/refund', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.APIPAY_API_KEY,
    'Idempotency-Key': 'refund-order_123-1',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ reason: 'Order cancelled by customer', hold_for_buyer_confirmation: true })
})

// Reconciliation: what happened to the order's money
const state = await fetch('https://api.apipay.kz/api/v1/invoices/42/refunds', {
  headers: { 'X-API-Key': process.env.APIPAY_API_KEY }
}).then(r => r.json())
```

### Python

```python
import os
import requests

# Partial refund. On a timeout, retry with the same Idempotency-Key and the same body.
requests.post('https://api.apipay.kz/api/v1/invoices/42/refund',
    headers={'X-API-Key': os.environ['APIPAY_API_KEY'],
             'Idempotency-Key': 'refund-order_123-2',
             'Content-Type': 'application/json'},
    json={'amount': 5000, 'reason': 'Partial return', 'hold_for_buyer_confirmation': True},
    timeout=15)
```

### PHP

```php
// Full refund
$ch = curl_init('https://api.apipay.kz/api/v1/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: ' . getenv('APIPAY_API_KEY'),
        'Idempotency-Key: refund-order_123-1',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'reason' => 'Order cancelled by customer',
        'hold_for_buyer_confirmation' => true,
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);
```
