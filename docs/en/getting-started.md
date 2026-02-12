# Getting Started

This guide will help you integrate ApiPay.kz into your application and start accepting Kaspi Pay payments.

## Prerequisites

Before you can create invoices, you need to:

1. **Get API Key** — Register at [baypay.bazarbay.site](https://baypay.bazarbay.site/login) and get your API key from the dashboard
2. **Connect Organization** — Contact support via WhatsApp to connect your Kaspi Business
3. **Start Creating Invoices** — Once connected, use the API or dashboard

## Step 1: Get API Key

1. Go to [baypay.bazarbay.site/login](https://baypay.bazarbay.site/login)
2. Sign in using WhatsApp authentication
3. Navigate to **Settings → Connection**
4. Copy your API key

## Step 2: Connect Organization

1. Contact support via [WhatsApp (+7 708 516 74 89)](https://wa.me/77085167489)
2. Provide your user ID from the dashboard
3. We will connect your Kaspi Business with **Cashier** rights
4. This usually takes 5-30 minutes during business hours

> **Important**: This is the only manual step. After connection, everything is automated.

## Step 4: Create Your First Invoice

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

## Step 5: Redirect Customer

Redirect your customer to `payment_url` to complete the payment:

```javascript
// After creating invoice
window.location.href = data.payment_url
```

The customer will:
1. Open Kaspi Pay in their browser
2. Confirm payment amount
3. Complete payment using Kaspi Gold card

## Step 6: Handle Payment Notifications

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
