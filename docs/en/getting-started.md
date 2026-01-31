# Getting Started

This guide will help you integrate ApiPay.kz into your application and start accepting Kaspi Pay payments.

## Prerequisites

Before you can create invoices, you need to:

1. **Get API Key** — Register at [baypay.bazarbay.site](https://baypay.bazarbay.site/login) and get your API key from the dashboard
2. **Configure Kaspi Business** — Add our service phone number to your Kaspi Business account
3. **Verify Organization** — Complete verification via API

## Step 1: Configure Kaspi Business

1. Open **Kaspi Business** app on your phone
2. Go to **Settings → Employees → Add Employee**
3. Add phone number: **77056610934**
4. Set role: **Cashier** (Кассир)
5. Confirm the addition

> **Important**: This step allows ApiPay.kz to create invoices on behalf of your organization.

## Step 2: Get API Key

1. Go to [baypay.bazarbay.site/login](https://baypay.bazarbay.site/login)
2. Sign in using WhatsApp authentication
3. Navigate to **Settings → Connection**
4. Copy your API key

## Step 3: Verify Organization

Send verification request with your IIN (Individual Identification Number) or BIN (Business Identification Number):

```bash
curl -X POST https://bpapi.bazarbay.site/api/organizations/verify \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"idn": "123456789012"}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idn` | string | Yes | 12-digit IIN or BIN |

**Response:**
```json
{
  "organization": {
    "id": 1,
    "status": "pending"
  },
  "message": "Verification started. Please confirm in Kaspi Business app."
}
```

## Step 4: Poll Verification Status

The user must confirm the verification in Kaspi Business app within 2 minutes.

Poll the status every 2 seconds:

```bash
curl https://bpapi.bazarbay.site/api/organizations/1/status \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**
```json
{
  "organization": {
    "id": 1,
    "idn": "123456789012",
    "status": "verified",
    "time_remaining": 95
  }
}
```

**Possible statuses:**
- `pending` — Waiting for confirmation
- `verified` — Organization verified, ready to create invoices
- `failed` — Verification failed

> **Note**: Verification times out after 120 seconds. If timeout occurs, start the process again.

## Step 5: Create Your First Invoice

Once verified, you can create invoices:

```bash
curl -X POST https://bpapi.bazarbay.site/api/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "phone_number": "87001234567",
    "description": "Order #123"
  }'
```

**Response:**
```json
{
  "id": 42,
  "kaspi_invoice_id": "13234689513",
  "kaspi_qr_token": "abc123",
  "payment_url": "https://kaspi.kz/pay/...",
  "amount": "10000.00",
  "status": "pending",
  "created_at": "2025-01-31T12:00:00Z"
}
```

## Step 6: Redirect Customer

Redirect your customer to `payment_url` to complete the payment:

```javascript
// After creating invoice
window.location.href = data.payment_url
```

The customer will:
1. Open Kaspi Pay in their browser
2. Confirm payment amount
3. Complete payment using Kaspi Gold card

## Step 7: Handle Payment Notifications

Set up a webhook to receive real-time payment notifications. See [Webhooks](webhooks.md) for details.

## API Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://bpapi.bazarbay.site/api` |
| Authentication | Header `X-API-Key: your_api_key` |
| Content-Type | `application/json` |
| Rate Limit | 60 requests/minute |

## Next Steps

- [Invoices](invoices.md) — Learn about invoice management
- [Recurring Payments](recurring.md) — Set up subscription billing
- [Webhooks](webhooks.md) — Configure payment notifications
- [Error Codes](errors.md) — Handle errors properly
