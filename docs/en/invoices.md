# Invoices

Invoices are the core of ApiPay.kz. Each invoice represents a payment request sent to a customer.

## Create Invoice

**Endpoint:** `POST /invoices`

Creates a new payment invoice. Supports two modes: flat amount or cart items.

### Request (flat amount)

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
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
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "87001234567",
    "description": "Cart order",
    "cart_items": [
      {"catalog_item_id": 101, "count": 2},
      {"catalog_item_id": 205, "count": 3}
    ]
  }'
```

Amount is calculated automatically from catalog item prices.

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes* | Amount in KZT (0.01 - 99,999,999.99). *Not required with cart_items. |
| `phone_number` | string | Yes | Customer phone (format: 8XXXXXXXXXX) |
| `description` | string | No | Payment description (max 500 chars) |
| `external_order_id` | string | No | Your order ID (max 255 chars) |
| `webhook_id` | number | No | Specific webhook ID from dashboard |
| `cart_items` | array | No | Array of cart items (replaces amount) |

### Cart Item Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `catalog_item_id` | integer | Yes | Catalog item ID (from GET /catalog) |
| `count` | integer | Yes | Quantity (min 1) |

### Response

```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "pending",
  "description": "Payment for order #123",
  "external_order_id": "order_123",
  "phone_number": "87001234567",
  "created_at": "2025-01-31T12:00:00Z"
}
```

## List Invoices

**Endpoint:** `GET /invoices`

```bash
curl "https://bpapi.bazarbay.site/api/v1/invoices?page=1&per_page=20&status[]=paid&sort_by=created_at&sort_order=desc" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 10 | Items per page (1-100) |
| `search` | string | — | Search in description/order ID |
| `status[]` | array | — | Filter by status |
| `date_from` | string | — | Start date (YYYY-MM-DD) |
| `date_to` | string | — | End date (YYYY-MM-DD) |
| `sort_by` | string | created_at | Sort field |
| `sort_order` | string | desc | `asc` or `desc` |

## Get Invoice

**Endpoint:** `GET /invoices/{id}`

```bash
curl https://bpapi.bazarbay.site/api/v1/invoices/42 \
  -H "X-API-Key: YOUR_API_KEY"
```

> Response includes `items` array — snapshot of cart items at invoice creation: `[{ id, invoice_id, catalog_item_id, name, price, count, unit_id }]`.

## Cancel Invoice

**Endpoint:** `POST /invoices/{id}/cancel`

Only invoices with `status: "pending"` can be cancelled. May return `202 Accepted` with status `cancelling` for async processing.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/42/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

## Check Invoice Status

**Endpoint:** `POST /invoices/status/check`

Force-check the current status of all pending invoices for your organization. Useful when webhooks are delayed.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/status/check \
  -H "X-API-Key: YOUR_API_KEY"
```

## Refund Invoice

**Endpoint:** `POST /invoices/{id}/refund`

See [Refunds](refunds.md) for details.

## Invoice Refunds

**Endpoint:** `GET /invoices/{id}/refunds`

```bash
curl https://bpapi.bazarbay.site/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

## Invoice Statuses

| Status | Description | Can Cancel | Can Refund |
|--------|-------------|------------|------------|
| `pending` | Awaiting payment | Yes | No |
| `cancelling` | Being cancelled (async) | No | No |
| `paid` | Payment completed | No | Yes |
| `cancelled` | Manually cancelled | No | No |
| `expired` | Payment timeout | No | No |
| `partially_refunded` | Partially refunded | No | Yes |
| `refunded` | Fully refunded | No | No |

## Status Flow

```
pending → paid → partially_refunded → refunded
    ↓        ↓
cancelling   refunded
    ↓
cancelled

pending → expired
```

## Code Examples

### JavaScript

```javascript
const response = await fetch('https://bpapi.bazarbay.site/api/v1/invoices', {
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
    'https://bpapi.bazarbay.site/api/v1/invoices',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 10000, 'phone_number': '87001234567', 'description': 'Order #123'}
)
invoice = response.json()
```

### PHP

```php
$ch = curl_init('https://bpapi.bazarbay.site/api/v1/invoices');
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
