# Catalog

The Catalog API allows you to manage your product catalog. Organizations with a catalog can create invoices with cart items (`cart_items`) instead of a flat amount.

## Measurement Units

**Endpoint:** `GET /catalog/units`

Returns available measurement units for catalog items.

```bash
curl https://api.apipay.kz/api/v1/catalog/units \
  -H "X-API-Key: YOUR_API_KEY"
```

Response: `{ "data": [{ "id": 1, "name": "шт", "name_kaz": "дана" }, ...] }`

## List Catalog Items

**Endpoint:** `GET /catalog`

```bash
curl "https://api.apipay.kz/api/v1/catalog?search=coffee&page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 50 | Items per page (1-200) |
| `search` | string | -- | Search by item name |
| `barcode` | string | -- | Filter by barcode |
| `first_char` | string | -- | Filter by first character of name |
| `statuses[]` | array | `active` | Filter by product statuses (multiple allowed): `active`, `pending`, `deleting`, `deleted`, `failed` |
| `without_ntin` | boolean | -- | `true` returns only items without an NTIN (`ntin` = `null`), regardless of a barcode — broader than the response field `ntin_missing` (which requires a non-empty `barcode`). Handy for estimating what's left to finish via `meta.total`. Composes with all modes and filters. |
| `ids[]`, `external_refs[]`, `barcodes[]`, `ntins[]` | array | -- | Targeted read: returns specific items in any status, without pagination |

> ⚠️ **Without `statuses[]` only `active` items are returned.** To see other statuses, list them explicitly: `?statuses[]=active&statuses[]=deleted`. That is also how you confirm a deletion reached Kaspi.

**Targeted read.** `ids[]`, `external_refs[]`, `barcodes[]` and `ntins[]` return specific items in any status and without pagination — the shape is `{"data": [...]}`. There are two caps: no more than 200 values across all four sets, and no more than 1000 matched rows. Going over either one returns `422` with `error_code: catalog_match_overflow` — split the request. This is the intended way to confirm the result of an upload or a deletion against your own 1C codes.

Each item in the response includes `created_at` — the creation timestamp in the system (ISO 8601). Available immediately after creation, even before Kaspi returns `date_added`.

Each item also includes `gtin` (string or `null`) — the GTIN from the National Catalog, if the item was created with one. The Kaspi listing does not return `gtin`, so catalog synchronization never overwrites it.

## Upload Image

**Endpoint:** `POST /catalog/upload-image`

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog/upload-image \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "image=@photo.jpg"
```

> Request must use `multipart/form-data`. JPEG and PNG only, max 6 MB, sides 64…6000 px, area up to 12 MP. gif, webp, bmp and svg are rejected (`422 invalid_file_type`) — convert them on your side. A file over 6 MB returns `413 file_too_large`. Limit: 60 requests per minute and 2000 per day per key.

### Response

```json
{
  "image_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Scan Barcode (National Catalog)

**Endpoint:** `POST /catalog/scan`

Resolves a barcode against Kaspi's National Catalog and returns candidate product cards. Use it before creating an item to pull the official name, NTIN, and GTIN. Runs synchronously.

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog/scan \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "4607015232646"}'
```

Field: `input` (required, string, max 64) — the barcode, entered manually or read from a scanner.

Response `200 OK`:

```json
{
  "data": [
    {
      "id": 1118196,
      "name": "ВАФЛИ ЯШКИНО ОРЕХОВЫЕ 300Г",
      "ntin": "0200009461097",
      "gtin": "4607015232646",
      "barcode": "4607015232646",
      "unit_id": null,
      "image_link": null
    }
  ],
  "normalized_barcode": "4607015232646",
  "scan_result": { "code": "ok", "message": null }
}
```

A single barcode may return several candidates (shared `gtin`, different `ntin`) — the merchant makes the final choice. The candidate fields (`id`, `name`, `ntin`, `gtin`, `barcode`, `unit_id`, `image_link`) are then passed into item creation.

If nothing is found, you get `data: []` and/or a `scan_result.code` other than `"ok"`. This is **not an error**: the HTTP status is still `200`. In that case, create the item the regular way, without `ntin`/`gtin`.

### Errors

| Code | Meaning | What to do |
|------|---------|------------|
| `422` | `input` is empty or longer than 64 characters | Fix the input |
| `400` `kaspi_session_expired` | The Kaspi session expired | Reconnect the Kaspi cashier, then retry |
| `429` `kaspi_throttled` | Too frequent (body has `retry_after_seconds`, header has `Retry-After`) | Wait the indicated time, then retry |
| `503` `kaspi_scan_unavailable` | The National Catalog is temporarily unavailable | Retry later |

**Rate limits:** 30 requests/min and 2000/day per API key. If Kaspi throttles requests, the endpoint returns `429 kaspi_throttled` — wait for the time in `retry_after_seconds` (the `Retry-After` header) before retrying.

**Typical flow:** scan the barcode → `POST /catalog/scan` → show `data[]` (if empty, create the item without `ntin`/`gtin`) → the merchant picks a candidate → `POST /catalog` with `ntin`/`gtin`/`from_catalog: true` → the item is created with status `pending` → it is pushed to Kaspi asynchronously → `active`.

## Create Catalog Items

**Endpoint:** `POST /catalog`

Batch create 1–100 items per request.

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "Coffee Latte", "selling_price": 1500, "unit_id": 1, "image_id": "550e8400-..."},
      {"name": "Americano", "selling_price": 1200, "unit_id": 1}
    ]
  }'
```

### Item Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Item name (max 255) |
| `selling_price` | number | Yes | Price in KZT (min 0.01) |
| `unit_id` | integer | Yes | Unit of measurement ID |
| `image_id` | string | No | Image UUID from upload-image |
| `barcode` | string | No | Barcode (optional, string, max 32 characters — a Kaspi limit) |
| `external_ref` | string | No | Your own reference for the item, for example a 1C item code (max 191) |
| `ntin` | string | No | NTIN of the selected National Catalog candidate (max 50) |
| `gtin` | string | No | GTIN, only for GS1 candidates (max 50) |
| `from_catalog` | boolean | No | Marks the item as created from the National Catalog (default `false`) |

The National Catalog fields are filled from the candidate chosen via `POST /catalog/scan`. Example item with catalog data: `{"name": "ВАФЛИ ЯШКИНО ОРЕХОВЫЕ 300Г", "selling_price": 450, "unit_id": 1, "barcode": "4607015232646", "ntin": "0200009461097", "gtin": "4607015232646", "from_catalog": true}`.

**Use `external_ref` as your mapping key**, not the barcode and not the name: a merchant can have several items sharing one barcode. `external_ref` is what later lets you read the item back precisely (`?external_refs[]=`), update it by re-uploading through `POST /catalog` and bring it back from the delete queue. `PATCH /catalog/{id}` does not accept `external_ref` — a targeted edit goes by `id`.

**Re-uploading does not create duplicates.** When an item matches an existing one, its live `id` comes back with the marker `matched_existing: true`. Matching goes by `external_ref` first, then by barcode or NTIN together with the name. If the barcode matches but the name differs, the item is matched without overwriting the name or the price — marker `name_differs: true`; change the name with an explicit `PATCH /catalog/{id}`. The `external_ref` of an existing item is never overwritten.

**One broken item does not fail the request.** Every item is validated on its own: valid ones go to `data[]`, rejected ones to `rejected[]`. The `rejected[]` key is always present in the response, empty included. `422` is reserved for structural errors in the request itself: `items` missing, not an array, empty, or longer than 100 items.

**The `Idempotency-Key` header** (or the `idempotency_key` field, max 191 characters) — repeating a request with the same key returns the existing batch (`200`) without creating the items again.

> ⚠️ The idempotency key space is **shared** with bulk deletion. A key already taken by an operation of a different type returns `409 idempotency_key_conflict` — take a new one; repeating with the same key will not help.

**The run marker `sync_token`** (optional, max 64 characters, alphabet `[A-Za-z0-9._:-]`) is stamped on every item the request mentions — including the ones that needed no work because they already matched the Kaspi catalog. The marker is what later lets you remove the remainder, "everything that was not in this upload" — see [Bulk Deletion](#bulk-deletion). Every request of one run sends the same token. A repeat under the same idempotency key does not refresh the token, so take your reference point before the first request of the run.

**Response code:** `202 Accepted` (production, items in status `pending`) / `201 Created` (sandbox, the item is active right away). The response carries `data[]`, `rejected[]` and a `batch` object; the item includes the `gtin` field.

## Update Catalog Item

**Endpoint:** `PATCH /catalog/{id}`

```bash
curl -X PATCH https://api.apipay.kz/api/v1/catalog/101 \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Coffee Latte Grande", "selling_price": 1800}'
```

Updatable fields: `name`, `selling_price`, `unit_id`, `image_id`, `is_image_deleted`, `barcode` (optional, string, max 32 characters — a Kaspi limit), `ntin` (optional, string, max 50), `gtin` (optional, string, max 50).

> ⚠️ **Important about `ntin`/`gtin`.** Send these fields only when you actually want to change the National Catalog identity. For a regular edit (for example, price only), **do not send** `ntin`/`gtin` — otherwise `null` overwrites the National Catalog identity in Kaspi. It cannot be restored by synchronization: the Kaspi listing does not return `gtin`.

**Response code:** `200 OK` (sandbox) / `202 Accepted` (production).

A `PATCH` on an item queued for deletion **cancels the deletion** — the item comes back into service. The exception is the narrow window in which the removal has already been sent to Kaspi: then you get `409 catalog_delete_in_progress`. Retry in a few seconds — the window lasts no longer than two minutes even if the removal attempt never completes. If the item has already been removed by then, a `PATCH` on it returns `404`: send it again with a regular `POST /catalog`. An `external_ref` brings back the same row with the same `id`; an item without one appears as a new row with a new `id`, and if its barcode matches another live item, the item you send merges into that one.

The `sync_token` field is accepted here as well. You need it when an item is maintained through `PATCH` only: without the marker it counts as not mentioned in the run and falls under the removal of the remainder. The marker is stamped whether or not any field actually changed.

## Delete Catalog Item

**Endpoint:** `DELETE /catalog/{id}`

**Response code:** `200 OK` (sandbox, the item is deleted right away) / `202 Accepted` (production).

```bash
curl -X DELETE https://api.apipay.kz/api/v1/catalog/101 \
  -H "X-API-Key: YOUR_API_KEY"
```

In production the item moves to the `deleting` status, and a background process takes it off sale in Kaspi.

> ⚠️ **The response arrives before the item disappears from the till.** Usually this takes seconds, but while a bulk catalog operation is running the queue is loaded and removal takes longer. Check the outcome by reading `GET /catalog?statuses[]=deleted`, not immediately after the response.

A failure during removal does not move the item to `failed`: it stays in `deleting` until it is removed — the service comes back to it on its own. **Do not send a repeat request.** In practice this means you will rarely see `failed` on deletions, and `deleting` will last longer.

**Error:** `409 catalog_multi_tradepoint` — the organization has several trade points, and catalog deletion through the API is not available for it. The item's state is unchanged. Unblocking goes through support.

## Bulk Deletion

**Endpoint:** `POST /catalog/bulk-delete`

Takes many items off sale in one request. `POST` rather than `DELETE`: a body on `DELETE` is poorly supported by 1C HTTP clients.

**Rate limit:** 10 requests/min per API key.

**The key must be issued by the organization owner.** A key tied to an employee gets `403 catalog_delete_owner_key_required` — reissue it as the owner. Only bulk deletion carries this requirement: wiping a whole catalog is not an integrator's routine operation.

### Two Modes

Set exactly one, otherwise you get `422 catalog_delete_scope_required`.

**List** — `ids[]` **or** `external_refs[]`. Both keys are unique within an organization, so one value maps to at most one item. No more than 200 values; going over returns `422 catalog_match_overflow`. The two sets are mutually exclusive as well: send both and you get the same `422 catalog_delete_scope_required` with `reason: mode_required`.

> ⛔ `barcodes[]` is not accepted: a barcode is not unique, and a single value could wipe hundreds of items. Barcodes go through the filter mode only, where `dry_run` exists.

**Filter** — `filter.sync_token_not`: "delete everything that was not in my upload". `expected_count` is mandatory: the set is large and the operation is irreversible. The filter mode is not capped at 200 and removes the whole matching remainder in one request.

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog/bulk-delete \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filter": {"sync_token_not": "run-2026-08-13-a"}, "expected_count": 6870}'
```

### Full Synchronization from 1C

1. Upload the current catalog through `POST /catalog`, sending the same `sync_token` in every request of the run.
2. Call `POST /catalog/bulk-delete` with `dry_run: true` — you learn how many items would be deleted and see a sample.
3. Repeat the same request without `dry_run`, passing that number in `expected_count`.
4. Wait for the `catalog.batch_processed` webhook with `kind: delete`, or poll `poll_url`.

If the number no longer matches, you get `409 catalog_bulk_delete_mismatch` with an `actual_count` field: the catalog changed between the scouting call and the command — repeat the `dry_run`. There is no "delete anyway" option.

> ⛔ Do not mirror deletions with a filter on modification time. `updated_at` does not move for items that matched the Kaspi catalog and does move for items touched by synchronization, so "delete everything that has not changed" would remove live items and spare dead ones.

### What the Filter Covers

`filter.sync_token_not` covers only items stamped with a **different** `sync_token`. An item with no marker at all — added by hand at the till, pulled in from the Kaspi catalog, uploaded before you started sending `sync_token` — does not count as remainder and is not deleted.

If you need those removed too, send `filter.include_never_stamped: true` explicitly. This is not a one-off step of the first run: unstamped items keep appearing as long as the catalog is used from the till.

**The run must be complete.** If the marker covers too small a share of the live catalog, the deletion is refused with `422 catalog_delete_filter_invalid`, `reason: coverage_too_low` and the numbers `stamped` (how many items the run marked) and `visible` (how many live items there are). This cuts off an interrupted upload: items the upload never reached still carry the marker of the *previous* run — neither empty nor equal to the current one — which means the entire remainder of the catalog would fall under the filter. The fix is to repeat the full upload, not to adjust `expected_count`.

If nothing at all carries the marker, you get `reason: token_never_used` — check that you sent the right token.

> ⚠️ **The list of `reason` values is open** — handle an unknown value in a generic branch. `catalog_delete_scope_required` has its own values: `mode_required` (no mode set, or more than one) and `expected_count_required`.

### This Is a Background Operation That Takes About a Day

Items are taken off sale one at a time, and while a bulk deletion runs, catalog uploads go slower — both operations share one queue. Orders of magnitude: 500 items take about two hours, several thousand take a bit over a day; with a parallel upload, multiply by roughly four. Plan your window from these numbers, not from the response time.

> ⛔ The `202` response means "accepted for processing", not "deleted". Do not set an HTTP timeout on this request expecting it to complete.

> ⚠️ Items queued for removal stop being accepted into carts immediately — including already printed `POST /static-qr` sheets that carry those items in `cart_items`. Scanning such a sheet will not create an invoice until the item is back on sale, and a printed sheet cannot be reissued. If items from active sheets fall under the deletion, bring them back with `POST /catalog` or reprint the sheets.

### Responses

`202` — the items were queued: `batch`, `queued`, `already_queued[]` (items that were already in the delete queue; they are not re-stamped) and `already_queued_count`.

`200` arrives in four different situations — tell them apart by which keys are present:

| Keys in the body | What it is |
|------------------|------------|
| `dry_run: true`, `would_delete`, `sample[]` | Scouting call, nothing changed |
| `batch` without `queued` | Replay under `Idempotency-Key`, the existing batch |
| `queued: 0` | Nothing to delete |
| `deleted` | Sandbox, deleted synchronously |

> ⚠️ In the `dry_run` body, `already_queued` is a **number** (a historical shape). In the `queued: 0`, sandbox and `202` bodies it is an array of `id`, with `already_queued_count` next to it. The `Idempotency-Key` replay body carries `batch` only — neither field is present.

### Errors

| Code | HTTP | Meaning |
|------|------|---------|
| `catalog_not_supported` | 400 | The organization has no catalog enabled. `400` rather than `422` on purpose: this is an organization precondition, not a request body error |
| `catalog_delete_owner_key_required` | 403 | The key was not issued by the organization owner |
| `tariff_inactive` | 403 | The tariff is not active |
| `catalog_bulk_delete_mismatch` | 409 | `expected_count` no longer matches the facts (`actual_count` in the body) — repeat the `dry_run` |
| `catalog_multi_tradepoint` | 409 | The organization has several trade points; deletion through the API is not available |
| `catalog_busy` | 409 | The catalog is busy with another operation, retry in a few seconds |
| `idempotency_key_conflict` | 409 | The key is taken by an operation of another type, take a new one |
| `catalog_delete_scope_required` | 422 | Detail in `reason`: `mode_required` or `expected_count_required` |
| `catalog_delete_filter_invalid` | 422 | Detail in `reason`: `token_never_used` or `coverage_too_low` |
| `catalog_match_overflow` | 422 | Too many values in the list |

### Bringing an Item Back

Send it with a regular `POST /catalog` and the deletion is cancelled. If the item has not been removed in Kaspi yet, it simply stays where it is; if the removal already went through, the item is recreated: an `external_ref` brings back the same row with the same `id`, while an item with no `external_ref`, barcode or NTIN appears in the catalog as a new row.

> ⛔ Two cases where bringing it back does not work:
>
> 1. the item has no `external_ref` and its barcode matches another, live item — the item you send merges into that live one, while the condemned item is removed as you planned. A return by `external_ref` is always unambiguous;
> 2. the removal of this particular item has already been sent to Kaspi — you get `catalog_delete_in_progress` (in `rejected[]` for `POST /catalog`, `409` for `PATCH /catalog/{id}`). Retry in a few seconds: if the item has been removed, it will be recreated.

## Item Statuses

| Status | What it means |
|--------|---------------|
| `pending` | The item is created on our side and waits to be sent to Kaspi |
| `active` | The item is registered in Kaspi and is on sale |
| `deleting` | Removal is scheduled or in progress; the item can no longer be sold |
| `deleted` | The item has been removed in Kaspi |
| `failed` | The item could not be processed; the reason is in the item's `error_code`/`error_message`, upload errors are additionally available via `GET /catalog/errors` |

> ⛔ **An item in the `deleting` status cannot be put into a cart.** The reason is monetary: during a bulk deletion an item stays in this status for a long time (see [Bulk Deletion](#bulk-deletion) for the orders of magnitude), and an invoice issued in that window would become a fiscal document for goods that no longer exist by the time it is paid.
>
> The item can be brought back — see [Bringing an Item Back](#bringing-an-item-back).

The shape of the refusal depends on the surface:

| Where | What you get |
|-------|--------------|
| `POST /invoices`, `POST /invoices/qr`, `POST /static-qr` | `422`; the reason is in `errors["cart_items.N.catalog_item_id"]`, this branch has no separate `error_code` |
| `POST /invoices/bulk` | The batch is still `201`: the item comes back in `invoices[]` as `failed` with `error_code: catalog_item_not_found`, the other invoices are created |
| `POST /subscriptions`, `PUT /subscriptions/{id}` | `422`, the same `errors` |
| A scheduled subscription charge | No refusal: the charge is postponed to the next charge attempt — the failure counter does not grow and the subscription does not enter the grace period |

The intake queue and the removal queue are counted separately: `GET /catalog/queue` returns a `deleting` counter — how many items are waiting to be removed in Kaspi.

## Using Catalog with Invoices

Create invoices with `cart_items` instead of a flat amount:

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "cart_items": [
      {"catalog_item_id": 101, "count": 2}
    ]
  }'
```

See [Invoices](invoices.md) for details.

## Code Examples

### JavaScript

```javascript
// X-API-Key is a secret — call the API from your server only, never from browser code
import { readFile } from 'node:fs/promises'

const API_KEY = process.env.APIPAY_KEY

// Upload image
const formData = new FormData()
formData.append('image', new Blob([await readFile('photo.jpg')]), 'photo.jpg')
const upload = await fetch('https://api.apipay.kz/api/v1/catalog/upload-image', {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY },
  body: formData
})
const { image_id } = await upload.json()

// Create items
await fetch('https://api.apipay.kz/api/v1/catalog', {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ name: 'Coffee Latte', selling_price: 1500, unit_id: 1, image_id }]
  })
})
```

### Python

```python
import requests

# Upload image
with open('photo.jpg', 'rb') as f:
    resp = requests.post('https://api.apipay.kz/api/v1/catalog/upload-image',
        headers={'X-API-Key': 'YOUR_API_KEY'}, files={'image': f})
image_id = resp.json()['image_id']

# Create items
requests.post('https://api.apipay.kz/api/v1/catalog',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'items': [{'name': 'Coffee Latte', 'selling_price': 1500, 'unit_id': 1, 'image_id': image_id}]})
```
