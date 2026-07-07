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
| Rate Limit | 60 requests/minute and 10 000 requests/day per API key |

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

## Business verification

When you go live in production, we ask you once to fill a short "Tell us about your business" form (~5 minutes in the dashboard, `/business-profile`): what you sell, where you sell, an approximate average check. This is not distrust — it protects your own Kaspi cashier by reducing the risk of a legitimate seller being blocked by anti-fraud, and lets us tune limits to your turnover.

Until the form is approved, a cautious start applies: **1 real invoice per day** (the **sandbox is unlimited** — test as much as you need). Over that, the API returns `429 kyc_daily_limit_reached` (`meta.reset_at` tells when the limit resets). Approval usually takes **1 business day**, after which the limit is lifted automatically.

Also: for not-yet-approved organizations a production webhook must be on a real domain — IPs and tunnels (ngrok) are rejected (see [Webhooks](webhooks.md)).

## What's Next?

- [Invoices](invoices.md) — Create, list, cancel invoices, use cart items
- [Subscriptions](subscriptions.md) — Automatic recurring billing
- [Catalog](catalog.md) — Product catalog management
- [Refunds](refunds.md) — Full and partial refunds
- [Webhooks](webhooks.md) — Get notified about payment events
- [Error Codes](errors.md) — Handle errors properly
