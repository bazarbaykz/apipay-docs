# Getting Started

## Prerequisites

Before using the ApiPay.kz API, you need to:

1. **Register** at [apipay.kz/login](https://apipay.kz/login)
2. **Connect your organization** — contact support via [WhatsApp (+7 708 516 74 89)](https://wa.me/77085167489) to connect your Kaspi Business as **"Cashier"**
3. **Wait for connection** (usually 5-30 minutes)
4. **Get your API key** from Dashboard → Settings → Connection

## Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://bpapi.bazarbay.site/api/v1` |
| Authentication | Header `X-API-Key: your_api_key` |
| Content-Type | `application/json` |
| Rate Limit | 60 requests/minute |

## Health Check

Verify the API is available (no authentication required):

```bash
curl https://bpapi.bazarbay.site/api/v1/status
```

## Your First Invoice

```bash
curl -X POST https://bpapi.bazarbay.site/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Response:
```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "pending",
  "phone_number": "87001234567",
  "created_at": "2025-01-15T10:00:00Z"
}
```

The customer will receive a payment notification in Kaspi app and can pay there.

## What's Next?

- [Invoices](invoices.md) — Create, list, cancel invoices, use cart items
- [Subscriptions](subscriptions.md) — Automatic recurring billing
- [Catalog](catalog.md) — Product catalog management
- [Refunds](refunds.md) — Full and partial refunds
- [Webhooks](webhooks.md) — Get notified about payment events
- [Error Codes](errors.md) — Handle errors properly
