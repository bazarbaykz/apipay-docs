# Invoices

Invoices are the core of ApiPay.kz. Each invoice represents a payment request that you send to a customer.

## Create Invoice

> **Note:** Creating invoices requires a verified organization.
> Complete verification in Dashboard → Verification before using this endpoint.

**Endpoint:** `POST /invoices`

Creates a new payment invoice. The customer must pay within the expiration period.

### Request

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "phone_number": "87001234567",
    "description": "Payment for order #123",
    "external_order_id": "order_123",
    "webhook_id": 1
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes | Amount in KZT (0.01 - 99,999,999.99) |
| `phone_number` | string | Yes | Customer phone (format: 8XXXXXXXXXX) |
| `description` | string | No | Payment description (max 500 chars) |
| `external_order_id` | string | No | Your order ID for reference (max 255 chars) |
| `webhook_id` | number | No | Specific webhook ID from dashboard |

### Response

```json
{
  "id": 42,
  "kaspi_invoice_id": "13234689513",
  "kaspi_qr_token": "abc123xyz",
  "payment_url": "https://kaspi.kz/pay/...",
  "amount": "10000.00",
  "status": "pending",
  "description": "Payment for order #123",
  "external_order_id": "order_123",
  "created_at": "2025-01-31T12:00:00Z"
}
```

### Response Fields

| Field | Description |
|-------|-------------|
| `id` | Internal invoice ID |
| `kaspi_invoice_id` | Kaspi system invoice ID |
| `kaspi_qr_token` | Token for QR code generation |
| `payment_url` | URL to redirect customer for payment |
| `amount` | Invoice amount |
| `status` | Current status |
| `created_at` | Creation timestamp |

## List Invoices

**Endpoint:** `GET /invoices`

Returns a paginated list of invoices.

### Request

```bash
curl "https://bpapi.bazarbay.site/api/invoices?page=1&per_page=20&status[]=paid" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 10 | Items per page (1-100) |
| `search` | string | — | Search in description/order ID (max 100 chars) |
| `status[]` | array | — | Filter by status (pending, paid, cancelled, expired) |
| `date_from` | string | — | Start date (YYYY-MM-DD) |
| `date_to` | string | — | End date (YYYY-MM-DD, must be >= date_from) |

### Response

```json
{
  "data": [
    {
      "id": 42,
      "amount": "10000.00",
      "status": "paid",
      "description": "Order #123",
      "created_at": "2025-01-31T12:00:00Z",
      "paid_at": "2025-01-31T12:05:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

## Get Invoice

**Endpoint:** `GET /invoices/:id`

Returns details of a specific invoice.

### Request

```bash
curl https://bpapi.bazarbay.site/api/invoices/42 \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response

```json
{
  "id": 42,
  "kaspi_invoice_id": "13234689513",
  "amount": "10000.00",
  "status": "paid",
  "description": "Payment for order #123",
  "external_order_id": "order_123",
  "client_name": "John Doe",
  "client_phone": "87001234567",
  "created_at": "2025-01-31T12:00:00Z",
  "paid_at": "2025-01-31T12:05:00Z"
}
```

## Cancel Invoice

**Endpoint:** `POST /invoices/:id/cancel`

Cancels a pending invoice. Only invoices with `status: "pending"` can be cancelled.

### Request

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices/42/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response

```json
{
  "id": 42,
  "status": "cancelled",
  "cancelled_at": "2025-01-31T12:10:00Z"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Invoice cannot be cancelled (not pending) |
| 404 | Invoice not found |

## Invoice Statuses

| Status | Description | Can Cancel | Can Refund |
|--------|-------------|------------|------------|
| `pending` | Awaiting customer payment | Yes | No |
| `paid` | Payment completed | No | Yes |
| `cancelled` | Manually cancelled | No | No |
| `expired` | Payment deadline passed | No | No |

## Status Flow

```
pending → paid → (refunded)
    ↓
cancelled

pending → expired
```

## Code Examples

### JavaScript

```javascript
// Create invoice
const response = await fetch('https://bpapi.bazarbay.site/api/invoices', {
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
// Redirect customer to invoice.payment_url
```

### Python

```python
import requests

response = requests.post(
    'https://bpapi.bazarbay.site/api/invoices',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'amount': 10000,
        'phone_number': '87001234567',
        'description': 'Payment for order #123'
    }
)
invoice = response.json()
# Redirect customer to invoice['payment_url']
```

### PHP

```php
$ch = curl_init('https://bpapi.bazarbay.site/api/invoices');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 10000,
        'phone_number' => '87001234567',
        'description' => 'Payment for order #123'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$response = json_decode(curl_exec($ch), true);
// Redirect customer to $response['payment_url']
```

## Best Practices

1. **Always store `external_order_id`** — Use it to match invoices with your orders
2. **Handle all statuses** — Check invoice status before taking action
3. **Set up webhooks** — Don't rely on polling for payment status
4. **Validate amounts** — Ensure amounts match your order totals
5. **Handle timeouts** — Invoices expire, create new ones when needed
