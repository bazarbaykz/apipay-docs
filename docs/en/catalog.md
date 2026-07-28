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
| `statuses[]` | array | -- | Filter by product statuses (multiple allowed): `active`, `pending`, `deleting`, `failed` |
| `without_ntin` | boolean | -- | `true` returns only items without an NTIN (`ntin` = `null`), regardless of a barcode — broader than the response field `ntin_missing` (which requires a non-empty `barcode`). Handy for estimating what's left to finish via `meta.total`. Composes with all modes and filters. |

Each item in the response includes `created_at` — the creation timestamp in the system (ISO 8601). Available immediately after creation, even before Kaspi returns `date_added`.

Each item also includes `gtin` (string or `null`) — the GTIN from the National Catalog, if the item was created with one. The Kaspi listing does not return `gtin`, so catalog synchronization never overwrites it.

## Upload Image

**Endpoint:** `POST /catalog/upload-image`

```bash
curl -X POST https://api.apipay.kz/api/v1/catalog/upload-image \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "image=@photo.jpg"
```

> Request must use `multipart/form-data`. Max 10 MB. Formats: jpg, png, gif, webp.

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
| `ntin` | string | No | NTIN of the selected National Catalog candidate (max 50) |
| `gtin` | string | No | GTIN, only for GS1 candidates (max 50) |
| `from_catalog` | boolean | No | Marks the item as created from the National Catalog (default `false`) |

The National Catalog fields are filled from the candidate chosen via `POST /catalog/scan`. Example item with catalog data: `{"name": "ВАФЛИ ЯШКИНО ОРЕХОВЫЕ 300Г", "selling_price": 450, "unit_id": 1, "barcode": "4607015232646", "ntin": "0200009461097", "gtin": "4607015232646", "from_catalog": true}`.

**Response code:** `202 Accepted` (async processing). The response item includes the `gtin` field.

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

## Delete Catalog Item

**Endpoint:** `DELETE /catalog/{id}`

**Response code:** `200 OK` (sandbox) / `202 Accepted` (production).

```bash
curl -X DELETE https://api.apipay.kz/api/v1/catalog/101 \
  -H "X-API-Key: YOUR_API_KEY"
```

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
