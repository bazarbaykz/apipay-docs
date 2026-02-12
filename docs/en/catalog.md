# Catalog

The Catalog API allows you to manage your product catalog. Organizations with a catalog can create invoices with cart items (`cart_items`) instead of a flat amount.

## List Catalog Items

**Endpoint:** `GET /catalog`

```bash
curl "https://bpapi.bazarbay.site/api/v1/catalog?search=coffee&page=1&per_page=20" \
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

## Upload Image

**Endpoint:** `POST /catalog/upload-image`

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/catalog/upload-image \
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

## Create Catalog Items

**Endpoint:** `POST /catalog`

Batch create 1-50 items.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/catalog \
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

## Update Catalog Item

**Endpoint:** `PATCH /catalog/{id}`

```bash
curl -X PATCH https://bpapi.bazarbay.site/api/v1/catalog/101 \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Coffee Latte Grande", "selling_price": 1800}'
```

Updatable fields: `name`, `selling_price`, `unit_id`, `image_id`, `is_image_deleted`.

## Delete Catalog Item

**Endpoint:** `DELETE /catalog/{id}`

```bash
curl -X DELETE https://bpapi.bazarbay.site/api/v1/catalog/101 \
  -H "X-API-Key: YOUR_API_KEY"
```

## Using Catalog with Invoices

Create invoices with `cart_items` instead of a flat amount:

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "cart_items": [
      {"Name": "Coffee Latte", "Price": 1500, "Count": 2, "Type": "CATALOGUE", "NomenclatureId": 101, "UnitId": 1}
    ]
  }'
```

See [Invoices](invoices.md) for details.

## Code Examples

### JavaScript

```javascript
// Upload image
const formData = new FormData()
formData.append('image', fileInput.files[0])
const upload = await fetch('https://bpapi.bazarbay.site/api/v1/catalog/upload-image', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY' },
  body: formData
})
const { image_id } = await upload.json()

// Create items
await fetch('https://bpapi.bazarbay.site/api/v1/catalog', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
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
    resp = requests.post('https://bpapi.bazarbay.site/api/v1/catalog/upload-image',
        headers={'X-API-Key': 'YOUR_API_KEY'}, files={'image': f})
image_id = resp.json()['image_id']

# Create items
requests.post('https://bpapi.bazarbay.site/api/v1/catalog',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'items': [{'name': 'Coffee Latte', 'selling_price': 1500, 'unit_id': 1, 'image_id': image_id}]})
```
