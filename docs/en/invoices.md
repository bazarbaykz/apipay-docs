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
      {"Name": "Coffee Latte", "Price": 1500, "Count": 2, "NomenclatureId": 12345, "Type": "CATALOGUE", "UnitId": 1, "NomenclatureHistoryId": 67890},
      {"Name": "Cookie", "Price": 500, "Count": 3, "NomenclatureId": -2, "Type": "FAST_SALE", "UnitId": 1}
    ]
  }'
```

Amount is calculated automatically from cart items: `1500*2 + 500*3 = 4500`.

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
| `Name` | string | Yes | Item name |
| `Price` | number | Yes | Unit price in KZT |
| `Count` | number | Yes | Quantity |
| `NomenclatureId` | number | Yes | Catalog item ID (or -2 for FAST_SALE) |
| `Type` | string | Yes | `CATALOGUE` or `FAST_SALE` |
| `UnitId` | number | Yes | Unit of measurement ID |
| `NomenclatureHistoryId` | number | No | Required for CATALOGUE type |

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

## Cancel Invoice

**Endpoint:** `POST /invoices/{id}/cancel`

Only invoices with `status: "pending"` can be cancelled. May return `202 Accepted` with status `cancelling` for async processing.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/42/cancel \
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

## Invoice Statistics

**Endpoint:** `GET /invoices/stats`

```bash
curl "https://bpapi.bazarbay.site/api/v1/invoices/stats?period=month" \
  -H "X-API-Key: YOUR_API_KEY"
```

Parameters: `period` (today, week, month, year) or `start_date` + `end_date` (YYYY-MM-DD).

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
