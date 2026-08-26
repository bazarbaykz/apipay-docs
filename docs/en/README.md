# ApiPay.kz — Kaspi Pay REST API

[![API Version](https://img.shields.io/badge/API-v2.1.0-blue.svg)](https://api.apipay.kz/api/v1)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/bazarbaykz/apipay-docs/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-available-green.svg)](getting-started.md)

**REST API for Kaspi Pay — automated invoicing, refunds, subscriptions, and catalog management.**

ApiPay.kz is an independent service that provides a REST API for Kaspi Pay. Automate invoice creation by phone number, process refunds, manage subscriptions, and maintain your product catalog.

[Russian Documentation (Русская документация)](../ru/README.md)

## Quick Start

### 1. Prerequisites

Before creating invoices, you must connect your Kaspi cashier:

1. Register at [ApiPay.kz](https://apipay.kz/login)
2. [Connect your Kaspi cashier](https://apipay.kz/connect-cashier) yourself in the dashboard (Settings → Kaspi Authorization) — a 2–3 minute wizard: add an employee with the **"Cashier"** role in the Kaspi Pay app, enter that number, confirm the SMS code. The connection is instant.
3. Get your API key from Settings → Connection

> Do not sign in to the Kaspi Pay app with the cashier's number afterwards — it breaks the connection. If the wizard does not work for you, [WhatsApp support](https://wa.me/77003076512) can connect it manually.

### 2. Create Invoice

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

The invoice is created asynchronously: `201` returns `status: "processing"`. The final status (`pending` or `error`) arrives via the `invoice.status_changed` webhook or from `GET /invoices/{id}`. Do not re-create the invoice while it is `processing`.

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /invoices` | Create payment invoice |
| `POST /invoices/qr` | Create QR invoice (cashier display) |
| `GET /invoices` | List invoices |
| `GET /invoices/{id}` | Get invoice details |
| `GET /invoices/{id}/receipt` | Kaspi receipt for a paid invoice |
| `POST /invoices/{id}/cancel` | Cancel pending invoice |
| `POST /invoices/{id}/refund` | Refund paid invoice |
| `GET /invoices/{id}/refunds` | Invoice refunds |
| `POST /invoices/status/check` | Check pending invoice statuses |
| `GET /refunds` | List all refunds |
| `POST /clients/check` | Check whether a phone number is registered in Kaspi |
| `POST /receipts` | Issue a fiscal receipt (Kaspi OFD) |
| `POST /receipts/preview` | Preview a receipt before issuing |
| `GET /receipts` | List fiscal receipts |
| `GET /receipts/{id}` | Get fiscal receipt status |
| `GET /catalog` | List catalog items |
| `POST /catalog/upload-image` | Upload catalog image |
| `POST /catalog` | Create catalog items |
| `PATCH /catalog/{id}` | Update catalog item |
| `DELETE /catalog/{id}` | Delete catalog item |
| `POST /catalog/bulk-delete` | Bulk-delete catalog items |
| `GET /catalog/queue` | Catalog queue remainder: items waiting to be created, edited and removed |
| `GET /catalog/errors` | Failed catalog operations over a period |
| `POST /catalog/scan` | Look up a product in the National Catalog by barcode |
| `GET /catalog/units` | List measurement units |
| `POST /subscriptions` | Create subscription |
| `GET /subscriptions` | List subscriptions |
| `GET /subscriptions/{id}` | Get subscription |
| `PUT /subscriptions/{id}` | Update subscription |
| `POST /subscriptions/{id}/pause` | Pause subscription |
| `POST /subscriptions/{id}/resume` | Resume subscription |
| `POST /subscriptions/{id}/cancel` | Cancel subscription |
| `GET /subscriptions/{id}/invoices` | Subscription invoices |
| `GET /cashbox/summary` | Cash summary for the day |
| `GET /cashbox/shifts` | List cash register shifts |
| `POST /cashbox/shifts/close` | Close a cash register shift |
| `GET /cashbox/reconciliation` | Reconcile invoices against a shift |
| `GET /cashbox/settings` | Cash register settings |

## Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | `https://api.apipay.kz/api/v1` |
| Authentication | Header `X-API-Key: your_api_key` |
| Rate Limit | 200 requests/minute per API key |

## Documentation

- [Getting Started](getting-started.md) — Prerequisites, connection, first invoice
- [Invoices](invoices.md) — Create, list, cancel invoices
- [Subscriptions](subscriptions.md) — Recurring billing and subscription management
- [Catalog](catalog.md) — Product catalog management
- [Refunds](refunds.md) — Full and partial refunds
- [Webhooks](webhooks.md) — Real-time payment notifications
- [Clients](clients.md) — Check a phone number before invoicing
- [Fiscal Receipts](receipts.md) — Kaspi OFD receipts for cash and non-Kaspi POS payments
- [Cash register](cashbox.md) — Kaspi shifts, cash, reconciliation and reports
- [Error Codes](errors.md) — HTTP status codes and error handling
- [Partner API](partner-api.md) — For CRM/platform integrators: onboard merchants and issue invoices on their behalf

## Code Examples

Ready-to-run examples in multiple languages:

- [JavaScript/Node.js](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/javascript)
- [Python](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/python)
- [PHP](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/php)
- [cURL](https://github.com/bazarbaykz/apipay-docs/tree/main/examples/curl)

## OpenAPI Specification

Full OpenAPI 3.0 specification is available at [openapi.yaml](https://github.com/bazarbaykz/apipay-docs/blob/main/openapi.yaml).

You can import it into [Swagger Editor](https://editor.swagger.io/), [Postman](https://www.postman.com/), or any other OpenAPI-compatible tool.

The [Partner API](partner-api.md) has a separate spec: [openapi-partner.yaml](https://github.com/bazarbaykz/apipay-docs/blob/main/openapi-partner.yaml).

## Support

- **WhatsApp**: [+7 700 307 6512](https://wa.me/77003076512)
- **Dashboard**: [apipay.kz](https://apipay.kz)
- **Issues**: [GitHub Issues](https://github.com/bazarbaykz/apipay-docs/issues)

## License

This project is licensed under the MIT License — see the [LICENSE](https://github.com/bazarbaykz/apipay-docs/blob/main/LICENSE) file for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](https://github.com/bazarbaykz/apipay-docs/blob/main/CONTRIBUTING.md) for guidelines.

---

Made with love in Kazakhstan
