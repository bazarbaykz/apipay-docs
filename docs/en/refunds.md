# Refunds

Process full or partial refunds for paid invoices.

## Create Refund

**Endpoint:** `POST /invoices/:id/refund`

Creates a refund for a paid invoice. You can refund the full amount or a partial amount.

### Full Refund

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer request"
  }'
```

### Partial Refund

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices/42/refund \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "reason": "Partial return"
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | No | Partial refund amount. Omit for full refund. |
| `reason` | string | No | Reason for refund (max 500 chars) |

### Response

```json
{
  "id": 1,
  "invoice_id": 42,
  "amount": "5000.00",
  "status": "completed",
  "reason": "Partial return",
  "created_at": "2025-01-31T14:00:00Z"
}
```

## List All Refunds

**Endpoint:** `GET /refunds`

Returns all refunds across all invoices.

```bash
curl "https://bpapi.bazarbay.site/api/refunds?page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Items per page |

### Response

```json
{
  "data": [
    {
      "id": 1,
      "invoice_id": 42,
      "amount": "5000.00",
      "status": "completed",
      "reason": "Partial return",
      "created_at": "2025-01-31T14:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 5
  }
}
```

## Get Refund

**Endpoint:** `GET /refunds/:id`

Get details of a specific refund.

```bash
curl https://bpapi.bazarbay.site/api/refunds/1 \
  -H "X-API-Key: YOUR_API_KEY"
```

## List Invoice Refunds

**Endpoint:** `GET /invoices/:id/refunds`

Get all refunds for a specific invoice.

```bash
curl https://bpapi.bazarbay.site/api/invoices/42/refunds \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response

```json
{
  "data": [
    {
      "id": 1,
      "amount": "3000.00",
      "status": "completed",
      "reason": "First partial refund",
      "created_at": "2025-01-31T14:00:00Z"
    },
    {
      "id": 2,
      "amount": "2000.00",
      "status": "completed",
      "reason": "Second partial refund",
      "created_at": "2025-01-31T15:00:00Z"
    }
  ]
}
```

## Refund Rules

1. **Only paid invoices** — You can only refund invoices with `status: "paid"`
2. **Multiple partial refunds** — You can issue multiple partial refunds up to the original amount
3. **Amount validation** — Partial refund amount cannot exceed remaining refundable amount

## Code Examples

### JavaScript

```javascript
// Full refund
const fullRefund = await fetch('https://bpapi.bazarbay.site/api/invoices/42/refund', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Customer cancellation'
  })
})

// Partial refund
const partialRefund = await fetch('https://bpapi.bazarbay.site/api/invoices/42/refund', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000,
    reason: 'Partial return - damaged item'
  })
})
```

### Python

```python
import requests

# Full refund
response = requests.post(
    'https://bpapi.bazarbay.site/api/invoices/42/refund',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'reason': 'Customer cancellation'
    }
)

# Partial refund
response = requests.post(
    'https://bpapi.bazarbay.site/api/invoices/42/refund',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'amount': 5000,
        'reason': 'Partial return'
    }
)
```

### PHP

```php
// Full refund
$ch = curl_init('https://bpapi.bazarbay.site/api/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'reason' => 'Customer cancellation'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);

// Partial refund
$ch = curl_init('https://bpapi.bazarbay.site/api/invoices/42/refund');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 5000,
        'reason' => 'Partial return'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$refund = json_decode(curl_exec($ch), true);
```

## Best Practices

1. **Always include a reason** — Helps with accounting and customer service
2. **Track refunded amounts** — Keep records of total refunded per invoice
3. **Validate before refunding** — Check invoice status and remaining amount
4. **Notify customers** — Send confirmation when refund is processed
