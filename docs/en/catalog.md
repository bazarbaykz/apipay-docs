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

Besides the status, an item carries the separate fields `operation`, `error_code`, `error_message`, `sellable` and `in_kaspi_catalog` — see [Item Statuses](#item-statuses).

> ⛔ The `batch_id` filter was removed together with the batch aggregate and is now **rejected explicitly**: `422` with `error_code: catalog_batch_filter_removed`. The rejection is triggered by the parameter being present at all — an empty `?batch_id=` returns `422` as well. Confirm your own set with a targeted request on `external_refs[]`.

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

> ⚠️ `normalized_barcode` is an **echo** of the value you sent, in production and in the sandbox alike — do not rely on the field normalizing anything. An NTIN and a barcode are different identifiers: a check like "`ntin` equals the barcode" is wrong.

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

**The `Idempotency-Key` header** (or the `idempotency_key` field, max 191 characters). An exact repeat of the same body within the same organization returns `200` with `idempotent_replay: true` and is not executed again.

> ⚠️ The idempotency key space is **shared** with bulk deletion. The same key with a different body, or on another catalog operation, returns `409 idempotency_key_conflict` — take a new one; repeating with the same key will not help.

**Response code:** always `202 Accepted` — "accepted". In production the item gets the `pending` status and is pushed to Kaspi by background processing; in the sandbox it comes back already active. The response shape is identical in both environments: `data[]` and `rejected[]`; the item includes the `gtin` field.

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

**The response code depends on the item, not on the organization's mode:** an edit to a sandbox item is already applied when the response arrives (`200 OK`), an edit to a production item is accepted for processing (`202 Accepted`).

> ⚠️ **`202` is not a confirmation.** In production the edit is delivered to Kaspi after the response, and with a loaded queue that delivery takes over a minute. Until it is confirmed, the item keeps `operation=update` and the full image intent, including a new `image_id` and its deletion. Check the outcome with a targeted `GET /catalog?ids[]=`, the `updating` counter in [`GET /catalog/queue`](#catalog-queue), the failures in [`GET /catalog/errors`](#catalog-errors), or the `catalog.item_processed` webhook.

> ⚠️ The new price appears in the `GET /catalog` response immediately, so seeing the value you sent there **does not prove** the edit reached Kaspi. The proof is `updating = 0` together with an empty `operation` on the item.

A `PATCH` on an item with `operation=delete` **cancels the deletion**: the request means "I need this item" and atomically replaces the intent. There is no longer a separate "removal already sent" refusal — if the removal did go through, the item is recreated with the same local `id`.

⛔ If the item has already been removed (`status: deleted`), a `PATCH` on it returns `404`: the lookup only covers live items. Create it again with a regular `POST /catalog` — an `external_ref` brings back the same row with the same `id`; an item without one appears as a new row with a new `id`, and if its barcode matches another live item, the item you send merges into that one. Only `POST /catalog` recreates an item; `PATCH` does not.

## Delete Catalog Item

**Endpoint:** `DELETE /catalog/{id}`

**The response code depends on the item, not on the organization's mode:** a sandbox item is already removed when the response arrives (`200 OK`), a production item is accepted for processing (`202 Accepted`) — it becomes `deleting` with `operation=delete` and moves to `deleted` once Kaspi confirms.

```bash
curl -X DELETE https://api.apipay.kz/api/v1/catalog/101 \
  -H "X-API-Key: YOUR_API_KEY"
```

> ⚠️ In both cases the removal is **logical**: the item stays readable through `GET /catalog?statuses[]=deleted` and is restored by re-uploading it under the same `external_ref` — the same item comes back with the same `id`.

> ⚠️ **The response arrives before the item disappears from the till.** The removal is delivered to Kaspi after the response, and with a loaded queue it takes over a minute. Check the outcome by reading `GET /catalog?statuses[]=deleted`, not immediately after the response.

After a temporary failure the item stays in `deleting` — the service comes back to it on its own, **do not send a repeat request**. Once the attempts are exhausted, the item reads as `failed` with `operation=delete`, `error_code` and `failed_at` preserved — and it still cannot be sold (`sellable: false`).

**An ambiguous trade point.** For a single deletion it no longer produces a synchronous `409`: the request is accepted with `202`, and `catalog_multi_tradepoint` appears on the item itself in the `error_code` field. For bulk deletion this refusal stays synchronous (`409`). Unblocking goes through support.

## Bulk Deletion

**Endpoint:** `POST /catalog/bulk-delete`

Takes many items off sale in one request. `POST` rather than `DELETE`: a body on `DELETE` is poorly supported by 1C HTTP clients.

**Rate limit:** 10 requests/min per API key.

**The key must be issued by the organization owner.** A key tied to an employee gets `403 catalog_delete_owner_key_required` — reissue it as the owner. Only bulk deletion carries this requirement: wiping a whole catalog is not an integrator's routine operation.

### What You Can Send

Targets are set by **exactly one list**: `ids[]` **or** `external_refs[]`. Both keys are unique within an organization, so one value maps to at most one item. No more than **200** values; going over returns `422 catalog_match_overflow`. Sending neither list, or both, returns `422 catalog_delete_scope_required`.

> ⛔ `barcodes[]` is not accepted: a barcode is not unique, and a single value could wipe hundreds of items.

> ⛔ **There is no "delete everything that was not in my upload" mode.** The server cannot tell an interrupted export from an honest shrink of the catalog, so the integrator builds the removal list. The `filter`, `sync_token` and `run_total` fields take no part in the operation: leftover fields from an older client are ignored, but without `ids[]`/`external_refs[]` the request answers `422 catalog_delete_scope_required`.

Optional fields: `dry_run` (count and show a sample only — nothing is changed and no `Idempotency-Key` is consumed) and `expected_count` (a cross-check against the number from the scouting call).

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog/bulk-delete \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 1c-sync-2026-08-26-chunk-01" \
  -d '{"external_refs": ["1C-000123", "1C-000124"], "expected_count": 2}'
```

### Full Synchronization from 1C

1. Upload the current catalog through `POST /catalog`.
2. Build the explicit list of items that are gone — `ids` or `external_refs` — on your side and split it into chunks of **200 values or fewer**.
3. For each chunk, call `POST /catalog/bulk-delete` with `dry_run: true` — you get `would_delete` (how many items would be deleted) and a `sample[]`.
4. Repeat the same request without `dry_run`, passing that `would_delete` in the optional `expected_count` and a **unique `Idempotency-Key` per chunk**.
5. Track the outcome through the remainder in [`GET /catalog/queue`](#catalog-queue), the rows through a targeted `GET /catalog?external_refs[]=`, and the failures in [`GET /catalog/errors`](#catalog-errors). The result of every single row is also pushed as a `catalog.item_processed` webhook.

If the number no longer matches, you get `409 catalog_bulk_delete_mismatch` with an `actual_count` field: the set changed between the scouting call and the command, **nothing is deleted** — repeat the `dry_run`. There is no "delete anyway" option.

> ⛔ Do not mirror deletions with a filter on modification time. `updated_at` does not move for items that matched the Kaspi catalog and does move for items touched by synchronization, so "delete everything that has not changed" would remove live items and spare dead ones.

> ⛔ **The operation has no overall handle.** The `GET /catalog/batches/{id}` endpoint has been removed, the `batch` and `poll_url` fields no longer appear in responses, and the `catalog.batch_processed` webhook is never sent — same address, same signature, just silence, and no error tells you so. "The work is done" is a conclusion the integrator draws from their own list of `external_ref` values.

### This Is a Background Operation That Takes About a Day

Items are taken off sale one at a time, and while a bulk deletion runs, catalog uploads go slower. Orders of magnitude: 500 items take about two hours, several thousand take a bit over a day; with a parallel upload, multiply by roughly four. Plan your window from these numbers, not from the response time.

> ⛔ The `202` response means "accepted for processing", not "deleted". Do not set an HTTP timeout on this request expecting it to complete.

> ⚠️ Items queued for removal stop being accepted into carts immediately — including already printed `POST /static-qr` sheets that carry those items in `cart_items`. Scanning such a sheet will not create an invoice until the item is back on sale, and a printed sheet cannot be reissued. If items from active sheets fall under the deletion, bring them back with `POST /catalog` or reprint the sheets.

### Responses

`202` — the items were queued for removal:

| Field | What it means |
|-------|---------------|
| `queued` | How many items were placed in the removal queue |
| `buried` | How many undelivered phantom rows were closed locally |
| `already_queued[]` | Items that were already in the delete queue; they are not re-stamped. ⚠️ The list is truncated to 200 entries — it is a sample, not the full set |
| `already_queued_count` | How many items were already queued, untruncated |

`200` arrives in four different situations — tell them apart by which keys are present:

| Keys in the body | What it is |
|------------------|------------|
| `dry_run: true`, `would_delete`, `sample[]` | Scouting call, nothing changed |
| `idempotent_replay: true` | An exact replay under `Idempotency-Key`; the request was not executed again |
| `queued: 0` | Nothing to delete |
| `deleted` | Sandbox, deleted synchronously |

> ⚠️ In the `dry_run` body, `already_queued` is a **number** (a historical shape). In the `queued: 0`, sandbox and `202` bodies it is an array of `id`, with `already_queued_count` next to it. The `Idempotency-Key` replay body carries `message` and `idempotent_replay` — neither field is present.

### Errors

| Code | HTTP | Meaning |
|------|------|---------|
| `catalog_not_supported` | 400 | The organization has no catalog enabled. `400` rather than `422` on purpose: this is an organization precondition, not a request body error |
| `catalog_delete_owner_key_required` | 403 | The key was not issued by the organization owner |
| `tariff_inactive` | 403 | The tariff is not active |
| `catalog_bulk_delete_mismatch` | 409 | `expected_count` no longer matches the facts (`actual_count` in the body) — nothing was deleted, repeat the `dry_run` |
| `catalog_multi_tradepoint` | 409 | The organization has several trade points; bulk deletion through the API is not available |
| `catalog_busy` | 409 | The catalog is busy with another operation, retry in a few seconds |
| `idempotency_key_conflict` | 409 | The key is taken by a different body or by another catalog operation, take a new one |
| `catalog_delete_scope_required` | 422 | Neither `ids[]` nor `external_refs[]` was set, or both lists were |
| `catalog_match_overflow` | 422 | More than 200 values in the list |

### Bringing an Item Back

Send it with a regular `POST /catalog` and the deletion is cancelled. If the item has not been removed in Kaspi yet, it simply stays where it is; if the removal already went through, the item is recreated: an `external_ref` brings back the same row with the same `id`, while an item with no `external_ref`, barcode or NTIN appears in the catalog as a new row.

> ⛔ There is one case where bringing it back is ambiguous: the item has no `external_ref` and its barcode matches another, live item — the item you send merges into that live one, while the condemned item is removed as you planned. A return by `external_ref` is always unambiguous.

There is no longer a separate "removal already sent" refusal: a new intent is accepted at any point, and if the removal did go through, the item is created again.

## Item Statuses

The `status` vocabulary is five mutually exclusive values, and the `GET /catalog?statuses[]=` filter accepts the same five:

| Status | What it means |
|--------|---------------|
| `pending` | The item is being created; it is not in the Kaspi catalog right now |
| `active` | The item is registered in Kaspi and is on sale |
| `deleting` | Removal is scheduled or in progress; the item can no longer be sold |
| `deleted` | The item has been removed in Kaspi |
| `failed` | An operation on the item was abandoned after its attempts ran out; the reason is in the item's `error_code`/`error_message`, and failures are additionally available via [`GET /catalog/errors`](#catalog-errors) |

**`status` is a derived field:** it is computed from the item's state rather than stored separately. The branch priority is fixed, first match wins:

```
failed → pending → deleting → deleted → active
```

An open operation is checked **above** the item's own state. Hence the counter-intuitive case: an item that was removed but already has a re-creation open reads as `pending`, not `deleted` — it is being created again.

### The Operation Axis

Alongside the status, the item carries a separate `operation` field — the single open intent on that item:

| Value | What it means |
|-------|---------------|
| `null` | No open intent |
| `create` | The item is being created or re-created |
| `update` | An edit was sent and is waiting for Kaspi to confirm it |
| `delete` | The item is being taken off sale |

On a failure the `operation` value is **kept** together with `error_code`, `error_message` and `failed_at`, so you can see exactly what did not go through. Any item with `operation: delete` is refused by the cart even after its deletion attempts have stopped; a repeat `POST /catalog` or `PATCH` replaces the intent and brings the item back into service.

### Sellability and Catalog Identity

These are two **different** facts and cannot be expressed by one flag. You do not need to derive them from `status` — they are returned ready:

| Field | What it means |
|-------|---------------|
| `sellable` | Whether the item is accepted into an invoice cart, a QR or a subscription. `false` for a removed item and for an item with an open deletion intent — even if the attempts have stopped |
| `in_kaspi_catalog` | Whether the item has a production Kaspi nomenclature identity. With `false` the invoice is still created, but the item goes through as a one-off sale, and no National Catalog marking is carried into the fiscal receipt |

> ⚠️ **In the sandbox `in_kaspi_catalog` is always `false`** — test items carry a synthetic nomenclature identity. That is a property of the test environment, not a prediction about a production item: check marking on the organization's production side.

An item can be sellable without a catalog identity, and vice versa.

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

## Catalog Queue

**Endpoint:** `GET /catalog/queue`

Shows what is left of your catalog intake queue. Now that the batch aggregate is gone, this is the main way to learn how much work is still open.

```bash
curl https://api.apipay.kz/api/v1/catalog/queue \
  -H "X-API-Key: YOUR_API_KEY"
```

Parameters: `sort_order` (`asc` — the closest to being processed first, the default; `desc`), `page`, `per_page` (20–200, default 100).

Pagination is **flat** — the fields sit at the root of the response, with no `meta` wrapper:

| Field | What it means |
|-------|---------------|
| `data[]` | Rows waiting to be **created**: `id`, `external_ref`, `name`, `queued_at` |
| `total` | How many items are waiting to be created |
| `updating` | How many existing items are waiting for Kaspi to confirm an edit (`operation: update`) |
| `deleting` | How many items are waiting to be removed in Kaspi |
| `queue` | A state summary: `state` and `eta_minutes` |

The three counters are tracked separately. Without `updating` and `deleting`, the response would look like "the queue is empty" while thousands of items are still waiting to be edited or removed.

`queue.state` explains why the queue may not be moving:

| Value | What it means |
|-------|---------------|
| `draining` | The queue is moving |
| `paused_throttle` | Paused because Kaspi is rate-limiting; the seconds until it resumes are in `throttle_retry_in_seconds` |
| `paused_hold` | Paused and accumulating |
| `not_connected` | The organization has no cashier connected |
| `sandbox` | The organization is in test mode |

`queue.eta_minutes` is an integer only when `state: draining` and your queue is not empty; otherwise it is `null`.

**Rate limit:** 600 requests/min per key, and it does not consume the general request limit.

## Catalog Errors

**Endpoint:** `GET /catalog/errors`

The failed catalog operations of your organization. Together with `GET /catalog/queue`, this is the only way to learn the outcome of bulk work if you do not receive webhooks.

```bash
curl "https://api.apipay.kz/api/v1/catalog/errors?from=2026-08-26" \
  -H "X-API-Key: YOUR_API_KEY"
```

Parameters: `from` and `to` bound the window by the **moment of failure** (`failed_at`); without `from` the last 7 days are used. Minutes and seconds are optional (`2026-08-26`, `2026-08-26 10`, `2026-08-26 10:30`). A bare date, and a date-time with no offset, are read in Asia/Almaty (+05:00) — the merchant's calendar day; an explicit offset is taken as given. A bare date in `to` covers the whole day, while a date-time means exactly that moment: `10` is `10:00:00`, not the end of the hour. `to` must not be earlier than `from`, otherwise you get `422`. There is also `sort_order` (default `desc`), `page` and `per_page` (20–200, default 100).

Pagination is flat here too: `current_page`, `data[]`, `total`. Row fields: `id`, `external_ref`, `name`, `barcode`, `ntin`, `operation` (what exactly failed), `error_code`, `error_message`, `queued_at`, `failed_at`.

The `error_message` texts are depersonalized — raw Kaspi responses are not returned.

> ⛔ The `batch_id` filter has been removed here as well and is **rejected explicitly**: `422 catalog_batch_filter_removed`. Select your own items by the `from`/`to` window and your own list of `external_ref` values.

**Rate limit:** 600 requests/min per key, and it does not consume the general request limit.

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
