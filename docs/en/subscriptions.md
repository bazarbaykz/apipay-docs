# Subscriptions

Subscriptions allow automatic recurring billing on a schedule — ideal for memberships, SaaS, and regular services.

## Create Subscription

**Endpoint:** `POST /subscriptions`

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/subscriptions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "phone_number": "87001234567",
    "subscriber_name": "John Doe",
    "description": "Monthly subscription",
    "billing_period": "monthly",
    "billing_day": 1
  }'
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes | Amount in KZT (100 - 1,000,000) |
| `phone_number` | string | Yes | Customer phone (format: 8XXXXXXXXXX) |
| `billing_period` | string | Yes | Billing cycle (see table below) |
| `billing_day` | integer | No | Day of billing (1-28) |
| `description` | string | No | Payment description (max 255 chars) |
| `subscriber_name` | string | No | Subscriber name (max 255 chars) |
| `external_subscriber_id` | string | No | Your external subscriber ID (max 255 chars) |
| `started_at` | string | No | Start date (YYYY-MM-DD, default: today) |
| `max_retry_attempts` | integer | No | Max retry attempts on failure (1-10) |
| `retry_interval_hours` | integer | No | Hours between retries (1-168) |
| `grace_period_days` | integer | No | Grace period in days (1-30) |
| `metadata` | object | No | Custom JSON data |
| `webhook_id` | number | No | Specific webhook ID from dashboard |
| `cart_items` | array | No | Cart items `[{ catalog_item_id, count }]` (for catalog orgs, recalculates amount) |

### Billing Periods

| Period | Description |
|--------|-------------|
| `daily` | Every day |
| `weekly` | Every 7 days |
| `biweekly` | Every 14 days |
| `monthly` | Same day each month |
| `quarterly` | Every 3 months |
| `yearly` | Same day each year |

### Response

```json
{
  "id": 1,
  "amount": "5000.00",
  "phone_number": "87001234567",
  "subscriber_name": "John Doe",
  "description": "Monthly subscription",
  "billing_period": "monthly",
  "billing_day": 1,
  "status": "active",
  "next_billing_date": "2025-03-01",
  "created_at": "2025-02-01T12:00:00Z"
}
```

## List Subscriptions

**Endpoint:** `GET /subscriptions`

```bash
curl "https://bpapi.bazarbay.site/api/v1/subscriptions?status=active&page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (1-100, default: 10) |
| `status` | string | Filter: `active`, `paused`, `cancelled`, `completed`, `expired` |
| `phone_number` | string | Filter by phone |
| `external_subscriber_id` | string | Filter by your subscriber ID |
| `search` | string | Search by name/phone |
| `billing_period` | string | Filter: daily, weekly, biweekly, monthly, quarterly, yearly |
| `sort_by` | string | Sort field (id, amount, subscriber_name, next_billing_date, created_at) |
| `sort_order` | string | `asc` or `desc` |

## Get Subscription

**Endpoint:** `GET /subscriptions/{id}`

Returns subscription with stats and last payment info.

```bash
curl https://bpapi.bazarbay.site/api/v1/subscriptions/1 \
  -H "X-API-Key: YOUR_API_KEY"
```

### Response

```json
{
  "id": 1,
  "amount": "5000.00",
  "phone_number": "87001234567",
  "subscriber_name": "John Doe",
  "billing_period": "monthly",
  "billing_day": 1,
  "status": "active",
  "next_billing_date": "2025-03-01",
  "stats": {
    "total_payments": 5,
    "total_amount": "25000.00",
    "failed_payments": 0
  },
  "last_payment": {
    "id": 42,
    "amount": "5000.00",
    "status": "paid",
    "paid_at": "2025-02-01T10:30:00Z"
  },
  "created_at": "2025-01-01T12:00:00Z"
}
```

## Update Subscription

**Endpoint:** `PUT /subscriptions/{id}`

```bash
curl -X PUT https://bpapi.bazarbay.site/api/v1/subscriptions/1 \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 7500, "description": "Premium monthly"}'
```

Updatable fields: `amount`, `billing_day`, `description`, `subscriber_name`, `max_retry_attempts`, `retry_interval_hours`, `grace_period_days`, `metadata`, `cart_items`.

## Pause Subscription

**Endpoint:** `POST /subscriptions/{id}/pause`

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/subscriptions/1/pause \
  -H "X-API-Key: YOUR_API_KEY"
```

## Resume Subscription

**Endpoint:** `POST /subscriptions/{id}/resume`

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/subscriptions/1/resume \
  -H "X-API-Key: YOUR_API_KEY"
```

## Cancel Subscription

**Endpoint:** `POST /subscriptions/{id}/cancel`

Permanently cancels. Cannot be resumed.

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/subscriptions/1/cancel \
  -H "X-API-Key: YOUR_API_KEY"
```

## Subscription Invoices

**Endpoint:** `GET /subscriptions/{id}/invoices`

```bash
curl "https://bpapi.bazarbay.site/api/v1/subscriptions/1/invoices?page=1&per_page=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

## Statuses

| Status | Description |
|--------|-------------|
| `active` | Billing on schedule |
| `paused` | Temporarily paused, can be resumed |
| `cancelled` | Permanently cancelled |
| `completed` | All billing cycles completed |
| `expired` | Expired after grace period |

## Grace Period

When a payment fails, the system enters a grace period:

1. **Payment fails** — System automatically retries
2. **Retries** — Up to `max_retry_attempts` times at `retry_interval_hours` intervals
3. **Grace period active** — Subscription remains `active` during retries
4. **Expired** — If all retries fail, subscription transitions to `expired`

Webhook events: `subscription.payment_failed`, `subscription.grace_period_started`, `subscription.payment_succeeded`, `subscription.expired`. See [Webhooks](webhooks.md).

## Code Examples

### JavaScript

```javascript
const response = await fetch('https://bpapi.bazarbay.site/api/v1/subscriptions', {
  method: 'POST',
  headers: {
    'X-API-Key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 5000,
    phone_number: '87001234567',
    billing_period: 'monthly',
    billing_day: 1
  })
})
const subscription = await response.json()
```

### Python

```python
import requests

response = requests.post(
    'https://bpapi.bazarbay.site/api/v1/subscriptions',
    headers={'X-API-Key': 'YOUR_API_KEY', 'Content-Type': 'application/json'},
    json={'amount': 5000, 'phone_number': '87001234567', 'billing_period': 'monthly'}
)
subscription = response.json()
```

### PHP

```php
$ch = curl_init('https://bpapi.bazarbay.site/api/v1/subscriptions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['X-API-Key: YOUR_API_KEY', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 5000, 'phone_number' => '87001234567', 'billing_period' => 'monthly'
    ]),
    CURLOPT_RETURNTRANSFER => true
]);
$subscription = json_decode(curl_exec($ch), true);
```
