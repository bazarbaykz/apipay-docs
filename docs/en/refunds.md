# Refunds

Process full or partial refunds for paid invoices.

## Create Refund

**Endpoint:** `POST /invoices/{id}/refund`

### Full Refund

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer request"}'
```

### Partial Refund

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "reason": "Partial return"}'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | No | Partial refund amount (0.01-99999999.99). Omit for full refund. |
| `reason` | string | No | Reason for refund (max 500 chars) |

### Response

```json
{
  "message": "Refund initiated successfully",
  "refund": {
    "id": 1,
    "invoice_id": 42,
    "amount": "5000.00",
    "status": "pending",
    "reason": "Partial return",
    "initiated_by": "api",
    "created_at": "2025-01-31T14:00:00Z"
  },
  "invoice": {
    "id": 42,
    "amount": "10000.00",
    "status": "partially_refunded",
    "total_refunded": "5000.00",
    "available_for_refund": "5000.00"
  }
}
```

## List All Refunds

**Endpoint:** `GET /refunds`

```bash
curl "https://bpapi.bazarbay.site/api/v1/refunds?page=1&per_page=20&status[]=completed" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (1-100, default: 10) |
| `status[]` | array | Filter: `pending`, `processing`, `completed`, `failed` |
| `invoice_id` | integer | Filter by invoice ID |
| `date_from` | string | Start date (YYYY-MM-DD) |
| `date_to` | string | End date (YYYY-MM-DD) |

## List Invoice Refunds

**Endpoint:** `GET /invoices/{id}/refunds`

```bash
curl https://bpapi.bazarbay.site/api/v1/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

## Refund Statuses

| Status | Description |
|--------|-------------|
| `pending` | Refund initiated, waiting to be processed |
| `processing` | Being processed by Kaspi |
| `completed` | Successfully completed |
| `failed` | Failed (e.g., Kaspi rejection) |

## Refund Rules

1. **Only paid invoices** — Refund invoices with `status: "paid"` or `"partially_refunded"`
2. **Multiple partial refunds** — Issue multiple partial refunds up to the original amount
3. **Amount validation** — Cannot exceed `available_for_refund`

## Code Examples

### JavaScript

```javascript
// Full refund
await fetch('https://bpapi.bazarbay.site/api/v1/invoices/42/refund', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'Customer cancellation' })
})

// Partial refund
await fetch('https://bpapi.bazarbay.site/api/v1/invoices/42/refund', {
  method: 'POST',
  headers: { 'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 5000, reason: 'Partial return' })
})

// List refunds with filters
const refunds = await fetch(
  'https://bpapi.bazarbay.site/api/v1/refunds?status[]=completed&date_from=2025-01-01',
  { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
)
```

### Python

```python
import requests

# Full refund
requests.post('https://bpapi.bazarbay.site/api/v1/invoices/42/refund',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'reason': 'Customer cancellation'})

# Partial refund
requests.post('https://bpapi.bazarbay.site/api/v1/invoices/42/refund',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 5000, 'reason': 'Partial return'})
```

### PHP

```php
// Full refund
$ch = curl_init('https://bpapi.bazarbay.site/api/v1/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['reason' => 'Customer cancellation']),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);
```
