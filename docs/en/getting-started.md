# Getting Started

## Prerequisites

Before using the ApiPay.kz API, you need to:

1. **Register** at [apipay.kz/login](https://apipay.kz/login)
2. **Connect your Kaspi cashier yourself** — use the wizard in the dashboard: [apipay.kz/connect-cashier](https://apipay.kz/connect-cashier) (Settings → Kaspi Authorization). It takes 2–3 minutes: add an employee number with the **"Cashier"** role in the Kaspi Pay app (Settings → Employees), enter that number in the wizard, and confirm the SMS code. The connection is instant. See the [step-by-step guide](https://apipay.kz/guides/podklyuchenie-kassira-kaspi) (in Russian).
3. **Get your API key** from Dashboard → Settings → Connection

> **Important:** after linking, do not sign in to the Kaspi Pay app with the cashier's number — the session will break and you will have to connect the cashier again.
>
> If the wizard does not work for you, we can connect it manually: [WhatsApp support (+7 708 516 74 89)](https://wa.me/77085167489).

## Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://api.apipay.kz/api/v1` |
| Authentication | Header `X-API-Key: your_api_key` |
| Content-Type | `application/json` |
| Rate Limit | 200 requests/minute per API key. Endpoint-specific limits: `POST /clients/check` — 60/min and 10 000/day, `POST /invoices/qr` — 60/min per organization, `GET /invoices/{id}` — 1000/min, `POST /invoices/bulk` — 20/min, `POST /catalog/scan` — 30/min and 2000/day |

## Your First Invoice

```bash
curl -X POST https://api.apipay.kz/api/v1/invoices \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "phone_number": "87001234567"}'
```

Response:
```json
{
  "id": 124,
  "amount": "10000.00",
  "status": "processing",
  "phone": "87001234567",
  "created_at": "2026-01-15T10:00:00+00:00"
}
```

The customer will receive a payment notification in Kaspi app and can pay there.

## Business verification

When you go live in production, we ask you once to fill a short "Tell us about your business" form (~5 minutes in the dashboard, `/business-profile`): what you sell, where you sell, an approximate average check. We use the answers to tune limits to your turnover.

Until the form is approved, a cautious start applies: **1 real invoice per day** (this daily limit does not apply in the sandbox — test within the sandbox quota). Over that, the API returns `429 kyc_daily_limit_reached` (`meta.reset_at` tells when the limit resets). Approval usually takes **1 business day**, after which the limit is lifted automatically.

Also: for not-yet-approved organizations a production webhook must be on a real domain — IPs and tunnels (ngrok) are rejected (see [Webhooks](webhooks.md)).

## What's Next?

- [Invoices](invoices.md) — Create, list, cancel invoices, use cart items
- [Subscriptions](subscriptions.md) — Automatic recurring billing
- [Catalog](catalog.md) — Product catalog management
- [Clients](clients.md) — Check a customer number before issuing an invoice
- [Refunds](refunds.md) — Full and partial refunds
- [Fiscal Receipts](receipts.md) — Issue receipts in Kaspi OFD for cash and POS payments
- [Webhooks](webhooks.md) — Get notified about payment events
- [Error Codes](errors.md) — Handle errors properly
- [Partner API](partner-api.md) — Connect your own clients to ApiPay
