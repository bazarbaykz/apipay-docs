# Recurring Payments

Recurring invoices allow you to automatically charge customers on a schedule — perfect for subscriptions, memberships, and regular billing.

## Create Recurring Invoice

**Endpoint:** `POST /recurring-invoices`

Creates a new recurring invoice schedule.

### Request

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "phone_number": "87001234567",
    "description": "Monthly subscription",
    "interval": "monthly",
    "start_date": "2025-02-01",
    "end_date": "2025-12-31",
    "webhook_id": 1
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes | Amount in KZT (0.01 - 99,999,999.99) |
| `phone_number` | string | Yes | Customer phone (format: 8XXXXXXXXXX) |
| `description` | string | No | Payment description (max 500 chars) |
| `interval` | string | Yes | Billing interval: `daily`, `weekly`, `monthly`, `yearly` |
| `start_date` | string | No | Start date (YYYY-MM-DD, default: today) |
| `end_date` | string | No | End date (YYYY-MM-DD) |
| `webhook_id` | number | No | Specific webhook ID |

### Response

```json
{
  "id": 1,
  "amount": "5000.00",
  "phone_number": "87001234567",
  "description": "Monthly subscription",
  "interval": "monthly",
  "status": "active",
  "start_date": "2025-02-01",
  "end_date": "2025-12-31",
  "next_billing_date": "2025-02-01",
  "created_at": "2025-01-31T12:00:00Z"
}
```

## List Recurring Invoices

**Endpoint:** `GET /recurring-invoices`

### Request

```bash
curl "https://bpapi.bazarbay.site/api/recurring-invoices?status=active" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Items per page |
| `status` | string | Filter: `active`, `paused`, `cancelled` |

## Get Recurring Invoice

**Endpoint:** `GET /recurring-invoices/:id`

```bash
curl https://bpapi.bazarbay.site/api/recurring-invoices/1 \
  -H "X-API-Key: YOUR_API_KEY"
```

## Update Recurring Invoice

**Endpoint:** `PUT /recurring-invoices/:id`

Update amount, description, or interval.

```bash
curl -X PUT https://bpapi.bazarbay.site/api/recurring-invoices/1 \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 7500,
    "description": "Premium monthly subscription"
  }'
```

## Pause Recurring Invoice

**Endpoint:** `POST /recurring-invoices/:id/pause`

Temporarily stops billing. Can be resumed later.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/pause \
  -H "X-API-Key: YOUR_API_KEY"
```

## Resume Recurring Invoice

**Endpoint:** `POST /recurring-invoices/:id/resume`

Resumes a paused recurring invoice.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/resume \
  -H "X-API-Key: YOUR_API_KEY"
```

## Cancel Recurring Invoice

**Endpoint:** `POST /recurring-invoices/:id/cancel`

Permanently cancels the recurring invoice. Cannot be resumed.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

## Bill Now

**Endpoint:** `POST /recurring-invoices/:id/bill-now`

Triggers immediate billing, creating a new invoice right now.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/bill-now \
  -H "X-API-Key: YOUR_API_KEY"
```

## Skip Period

**Endpoint:** `POST /recurring-invoices/:id/skip-period`

Skips the next billing period without charging.

```bash
curl -X POST https://bpapi.bazarbay.site/api/recurring-invoices/1/skip-period \
  -H "X-API-Key: YOUR_API_KEY"
```

## Recurring Invoice Statuses

| Status | Description |
|--------|-------------|
| `active` | Billing on schedule |
| `paused` | Temporarily paused |
| `cancelled` | Permanently cancelled |

## Status Flow

```
active ←→ paused
   ↓
cancelled
```

## Code Examples

### JavaScript

```javascript
// Create monthly subscription
const response = await fetch('https://bpapi.bazarbay.site/api/recurring-invoices', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000,
    phone_number: '87001234567',
    description: 'Monthly subscription',
    interval: 'monthly'
  })
})
const subscription = await response.json()
console.log(`Next billing: ${subscription.next_billing_date}`)
```

### Python

```python
import requests

# Create weekly recurring invoice
response = requests.post(
    'https://bpapi.bazarbay.site/api/recurring-invoices',
    headers={
        'X-API-Key': 'YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'amount': 1000,
        'phone_number': '87001234567',
        'description': 'Weekly delivery',
        'interval': 'weekly'
    }
)
subscription = response.json()
```

### PHP

```php
// Create yearly subscription
$ch = curl_init('https://bpapi.bazarbay.site/api/recurring-invoices');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 50000,
        'phone_number' => '87001234567',
        'description' => 'Annual membership',
        'interval' => 'yearly'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$subscription = json_decode(curl_exec($ch), true);
```

## Billing Intervals

| Interval | Description |
|----------|-------------|
| `daily` | Every day at the same time |
| `weekly` | Every 7 days |
| `monthly` | Same day each month |
| `yearly` | Same day each year |

## Best Practices

1. **Set end dates for trials** — Use `end_date` for limited-time offers
2. **Use webhooks** — Get notified when payments succeed or fail
3. **Handle failures gracefully** — Paused subscriptions mean payment issues
4. **Allow customers to pause** — Better than cancellation
5. **Update, don't recreate** — Use PUT to change subscription terms
