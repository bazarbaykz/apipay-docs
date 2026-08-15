# Fiscal Receipts

Issue a fiscal receipt in Kaspi OFD for payments that did **not** go through Kaspi QR.

When a customer pays via Kaspi QR, Kaspi produces the receipt itself — you don't have to do anything. But if the payment was made **in cash** or **via another bank's POS terminal**, Kaspi does not create a fiscal receipt, and you must issue it through the API. The payment method is set by the `payment_type` field:

| `payment_type` | Payment method |
|----------------|----------------|
| `3` | Cash |
| `5` | Another bank's POS terminal |

## Prerequisites

Before issuing a receipt, make sure that:

1. **Writing through the cashier is not paused.** Issuing receipts is available unconditionally; `403 fiscal_receipts_disabled` only arrives when writing through the cashier the receipt is addressed to has been paused — use another cashier (`kaspi_connection_id`) or resume writing. Reading the history (`GET /receipts`, `GET /receipts/{id}`) is not gated by anything.
2. **A Kaspi cashier is connected.** You need an active cashier (Settings → Kaspi Authorization). Otherwise — `409 kaspi_session_not_configured`. If the organization has several active cashiers and no primary one is selected, pass `kaspi_connection_id` (otherwise `422 connection_ambiguous`).
3. **The shift is open.** The merchant opens the shift in the Kaspi Pos app. If the shift is closed, the receipt fails with status `failed` and `error_code = shift_closed`.
4. **Line items are fiscal.** Only items from the synchronized catalog (by `catalog_item_id`) that are fiscally registered (with NTIN and barcode) go into the receipt. An item without an NTIN fails the receipt with `item_not_fiscal`. Resolve the NTIN via `POST /catalog/scan` + `PATCH /catalog/{id}` (see [Catalog](catalog.md)).

## Preview a Receipt

A synchronous preview of the receipt before issuing it — for example, to show the cashier the receipt lines (amount and payment method) on screen.

**Endpoint:** `POST /receipts/preview`

```bash
curl -X POST https://api.apipay.kz/api/v1/receipts/preview \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": 3,
    "total_price": 10.00
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payment_type` | integer | Yes | `3` — cash, `5` — another bank's POS |
| `total_price` | number | Yes | Receipt total |
| `kaspi_connection_id` | integer | No | Specific cashier. Defaults to the primary / only active one |

### Response

```json
{
  "data": [
    { "Title": "Payment method", "Subtitle": "Cash", "isBoldText": false },
    { "Title": "Total", "Subtitle": "10.00 ₸", "isBoldText": true }
  ]
}
```

> In the sandbox, the preview is deterministic and produced without calling Kaspi.

## Issue a Receipt

Issues a fiscal receipt asynchronously. The request creates the receipt with status `pending` and queues the issuing job; the outcome is learned via polling or webhook (see below).

**Endpoint:** `POST /receipts`

```bash
curl -X POST https://api.apipay.kz/api/v1/receipts \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": 3,
    "client_operation_id": "pos-2026-07-12-0042",
    "received_amt": 500,
    "cart_items": [
      { "catalog_item_id": 12345, "quantity": 1 }
    ]
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payment_type` | integer | Yes | `3` — cash, `5` — another bank's POS |
| `client_operation_id` | string | Yes | Idempotency key, unique per organization (max 191 chars). See [Idempotency](#idempotency) |
| `cart_items` | array | Yes | Receipt line items from the catalog (1–100). Each has `catalog_item_id` and `quantity`; optionally `price` (unit price, defaults to `selling_price` from the catalog) |
| `received_amt` | number | No | **Cash only:** amount received from the customer (>= total, to compute change). For another bank's POS (`5`) it is ignored and set equal to the total |
| `kaspi_connection_id` | integer | No | Specific cashier. Defaults to the primary / only active one |

### Response

```json
{
  "id": 4210,
  "status": "pending",
  "client_operation_id": "pos-2026-07-12-0042"
}
```

The HTTP status is `202 Accepted`: the receipt is accepted for processing but not yet issued. Wait for a terminal status (`issued` or `failed`) via polling or webhook.

## Get the Result

The receipt is issued asynchronously. You can learn the outcome in two equivalent ways.

### Poll the status

**Endpoint:** `GET /receipts/{id}`

```bash
curl https://api.apipay.kz/api/v1/receipts/4210 \
  -H "X-API-Key: YOUR_API_KEY"
```

```json
{
  "id": 4210,
  "status": "issued",
  "payment_type": 3,
  "client_operation_id": "pos-2026-07-12-0042",
  "total_price": "10.00",
  "received_amt": "500",
  "fpd": "000000000000",
  "operation_id": "KKM00000000",
  "operation_time": "2026-07-12T16:25:40+00:00",
  "shift_number": 106,
  "link": "https://receipt.kaspi.kz/preview/cashier?extTranId=KKM00000000",
  "error_code": null,
  "error_message": null,
  "created_at": "2026-07-12T16:25:38+00:00"
}
```

While the receipt is not yet issued, `status: "pending"` and the details (`fpd`, `operation_id`, `link`, `shift_number`) are `null`. On success — `status: "issued"` with the details filled in. On failure — `status: "failed"`, details `null`, reason in `error_code` / `error_message`. A foreign `id` (a receipt of another organization) → `404 receipt_not_found`.

### Webhook

The same outcome arrives as a `receipt.issued` (success) or `receipt.failed` (failure) webhook — see [Webhooks](webhooks.md). Webhooks sit behind a separate gate; if they are not enabled for you, use polling.

## Idempotency

`client_operation_id` is your idempotency key, **unique per organization**. It protects against issuing a receipt twice when a request is resent (a dropped connection, a retry, a cashier's double click).

- Repeating `POST /receipts` with an already-used `client_operation_id` does **not** issue a second receipt; it returns `409 duplicate_client_operation_id`. The response body carries `receipt_id` and the current `status` of the first receipt — use them to find the original one via `GET /receipts/{id}`.
- If the previous attempt ended in `failed`, repeating with the same `client_operation_id` is **allowed** — you can re-issue the receipt.

> Generate `client_operation_id` deterministically from the sale operation (e.g. `pos-2026-07-12-0042`), not randomly per request — then a network retry lands on the same key and no duplicate is created.

## Receipt Statuses

| Status | Description |
|--------|-------------|
| `pending` | The receipt is created, the issuing job is queued |
| `issued` | The receipt was successfully issued in Kaspi OFD; details (`fpd`, `operation_id`, `link`) are filled in |
| `failed` | Issuing failed; reason in `error_code` / `error_message`. A retry with the same `client_operation_id` is allowed |

## Error Codes

| Code | HTTP | When | What to do |
|------|------|------|------------|
| `fiscal_receipts_disabled` | 403 | The fiscal receipts feature is disabled | Contact support to enable it |
| `kaspi_session_not_configured` | 409 | No active Kaspi cashier | Connect a cashier: dashboard → Settings → Kaspi Authorization |
| `duplicate_client_operation_id` | 409 | `client_operation_id` already used | Find the original receipt by `receipt_id` from the response body; a retry is allowed only after `failed` |
| `connection_ambiguous` | 422 | Several active cashiers, no primary selected | Pass `kaspi_connection_id` |
| `receipt_preview_unavailable` | 503 | Kaspi is unavailable for preview | Retry later |
| `receipt_not_found` | 404 | Receipt not found or belongs to another organization | Check the `id` |
| `shift_closed` | — (in `failed`) | The shift in Kaspi Pos is closed | Open the shift in the Kaspi Pos app and issue the receipt again |
| `item_not_fiscal` | — (in `failed`) | A line item has no NTIN — it is not fiscal | Resolve the NTIN (`POST /catalog/scan` + `PATCH /catalog/{id}`) and retry |
| `rfo_missing` | — (in `failed`) | The point of sale (RFO) is not determined | Contact support |
| `receipt_kaspi_error` | — (in `failed`) | Kaspi rejected the issuing | The reason is in `error_message`; contact support if needed |
| `receipt_dispatch_error` | — (in `failed`) | A technical dispatch failure | Retry with the same `client_operation_id` |
| `receipt_ofd_token_revoked` | — (in `failed`) | The till's fiscal link to the OFD has been revoked | The merchant must re-link the OFD in the Kaspi app, then issue the receipt again. Waiting does not fix it |
| `kaspi_session_invalid` | — (in `failed`) | The cashier session is not valid | Reconnect the cashier and issue the receipt again |
| `kaspi_session_expired` | 409 | The Kaspi cashier session is dead — the receipt will not reach Kaspi | Reconnect the cashier (dashboard → Settings → Kaspi Authorization) and issue the receipt again |
| `tariff_inactive` | 403 | The ApiPay subscription is not active | Pay for the plan in the dashboard: billable operations, receipts included, are blocked as soon as it lapses |

> Codes without an HTTP status arrive on a failed receipt (`status=failed`) — in the `error_code` field of the `GET /receipts/{id}` response and in the `receipt.failed` webhook. Build your logic on `error_code`, not on the `error_message` text.

### A Revoked OFD Link

`receipt_ofd_token_revoked` means Kaspi has revoked the till's **fiscal** link. It arrives in the `receipt.failed` webhook and in `GET /receipts/{id}`; it will not appear in the response of `POST /receipts` itself — that endpoint is asynchronous and always answers `202` with `status: pending`, and the code is set later.

- **Taking payments keeps working** — invoices and QR codes are still created. Only fiscal receipts and catalog writes stop.
- **A retry will not help while the link is revoked.** The action is on the merchant's side: re-link the OFD in the Kaspi app. After that the receipt is issued again — no fiscal document was created, so the same `client_operation_id` is allowed.
- **Do not confuse it with `kaspi_session_invalid`:** there the payment session is dead and the cashier must be reconnected, here the session is alive.
- This case used to arrive as `receipt_kaspi_error`. If you branch on that code, add the new one to your handling.
- The `simulate` parameter does not reproduce this outcome in the sandbox.

## Code Examples

### JavaScript

```javascript
// 1. Preview the receipt
const preview = await fetch('https://api.apipay.kz/api/v1/receipts/preview', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ payment_type: 3, total_price: 10.0 })
}).then(r => r.json())

// 2. Issue the receipt (cash)
const receipt = await fetch('https://api.apipay.kz/api/v1/receipts', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payment_type: 3,
    client_operation_id: 'pos-2026-07-12-0042',
    received_amt: 500,
    cart_items: [{ catalog_item_id: 12345, quantity: 1 }]
  })
}).then(r => r.json())

// 3. Wait for the result (polling)
async function pollReceipt(id) {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`https://api.apipay.kz/api/v1/receipts/${id}`, {
      headers: { 'X-API-Key': 'YOUR_API_KEY' }
    }).then(r => r.json())
    if (r.status !== 'pending') return r
    await new Promise(res => setTimeout(res, 3000))
  }
}
const result = await pollReceipt(receipt.id)
```

### Python

```python
import requests, time

BASE = 'https://api.apipay.kz/api/v1'
HEADERS = {'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'}

# 1. Issue the receipt (cash)
receipt = requests.post(f'{BASE}/receipts', headers=HEADERS, json={
    'payment_type': 3,
    'client_operation_id': 'pos-2026-07-12-0042',
    'received_amt': 500,
    'cart_items': [{'catalog_item_id': 12345, 'quantity': 1}],
}).json()

# 2. Wait for the result (polling)
def poll_receipt(receipt_id):
    for _ in range(20):
        r = requests.get(f'{BASE}/receipts/{receipt_id}', headers=HEADERS).json()
        if r['status'] != 'pending':
            return r
        time.sleep(3)

result = poll_receipt(receipt['id'])
```

### PHP

```php
$base = 'https://api.apipay.kz/api/v1';
$headers = ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'];

// Issue the receipt (cash)
$ch = curl_init("$base/receipts");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => json_encode([
        'payment_type' => 3,
        'client_operation_id' => 'pos-2026-07-12-0042',
        'received_amt' => 500,
        'cart_items' => [['catalog_item_id' => 12345, 'quantity' => 1]],
    ]),
    CURLOPT_RETURNTRANSFER => true,
]);
$receipt = json_decode(curl_exec($ch), true);

// Check the status
$ch = curl_init("$base/receipts/{$receipt['id']}");
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RETURNTRANSFER => true,
]);
$status = json_decode(curl_exec($ch), true);
```
